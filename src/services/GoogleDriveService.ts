import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { getDb } from '../db/DatabaseService';
import { encrypt, decrypt } from '../utils/crypto';
import { Note } from '../types';
import { Scalar } from '@op-engineering/op-sqlite';
import { Store } from '../store/mmkv';

// Configure once at app start — call from App.tsx
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    // Replace with your Web client ID from Google Cloud Console
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });
}

const DRIVE_FILE_NAME = 'secondbrain_backup.json';

async function getAccessToken(): Promise<string> {
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}

async function findBackupFileId(accessToken: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D%27${DRIVE_FILE_NAME}%27%20and%20trashed%3Dfalse&spaces=drive&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function uploadToDrive(accessToken: string, json: string, fileId: string | null): Promise<void> {
  const metadata = JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' });
  const body = new FormData();
  body.append('metadata', { string: metadata, type: 'application/json', name: 'metadata' } as any);
  body.append('file', { string: json, type: 'application/json', name: DRIVE_FILE_NAME } as any);

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = fileId ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${err}`);
  }
}

async function downloadFromDrive(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error('Drive download failed');
  return res.text();
}

export const GoogleDriveService = {
  // Call once at startup
  configure: configureGoogleSignIn,

  async signIn(): Promise<{ email: string; name: string }> {
    await GoogleSignin.hasPlayServices();
    const info = await GoogleSignin.signIn();
    const user = info.data?.user;
    if (!user) throw new Error('Sign in failed');
    return { email: user.email, name: user.givenName ?? user.name ?? user.email };
  },

  async signOut(): Promise<void> {
    await GoogleSignin.signOut();
  },

  async getCurrentUser(): Promise<{ email: string; name: string } | null> {
    try {
      const info = await GoogleSignin.getCurrentUser();
      const user = info?.data?.user;
      if (!user) return null;
      return { email: user.email, name: user.givenName ?? user.name ?? user.email };
    } catch {
      return null;
    }
  },

  async backup(passphrase: string): Promise<void> {
    const db = getDb();
    const result = db.executeSync(`SELECT * FROM notes WHERE is_deleted = 0`);
    const notes = (result.rows ?? []).map((r: Record<string, Scalar>) => r as unknown as Note);
    const json = JSON.stringify({ version: 1, notes, exportedAt: Date.now() });
    const encrypted = encrypt(json, passphrase);

    const token = await getAccessToken();
    const existingId = await findBackupFileId(token);
    await uploadToDrive(token, encrypted, existingId);
    await Store.setLastGoogleBackupAt(Date.now());
  },

  async restore(passphrase: string): Promise<{ imported: number; skipped: number }> {
    const token = await getAccessToken();
    const fileId = await findBackupFileId(token);
    if (!fileId) throw new Error('No backup found in Google Drive.');

    const encrypted = await downloadFromDrive(token, fileId);
    const json = decrypt(encrypted, passphrase);
    if (!json) throw new Error('Wrong passphrase or corrupted backup.');

    const { notes } = JSON.parse(json) as { notes: Note[] };
    const db = getDb();
    let imported = 0, skipped = 0;

    for (const note of notes) {
      const existing = db.executeSync(`SELECT updated_at FROM notes WHERE id = ?`, [note.id]);
      const row = existing.rows?.[0];
      if (!row) {
        db.executeSync(
          `INSERT INTO notes (id,title,body,body_preview,created_at,updated_at,is_deleted) VALUES (?,?,?,?,?,?,?)`,
          [note.id, note.title, note.body, note.body_preview, note.created_at, note.updated_at, note.is_deleted],
        );
        imported++;
      } else if ((row.updated_at as number) < note.updated_at) {
        db.executeSync(
          `UPDATE notes SET title=?,body=?,body_preview=?,updated_at=?,is_deleted=? WHERE id=?`,
          [note.title, note.body, note.body_preview, note.updated_at, note.is_deleted, note.id],
        );
        imported++;
      } else {
        skipped++;
      }
    }
    return { imported, skipped };
  },
};
