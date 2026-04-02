import RNFS from 'react-native-fs';
import { getDb } from '../db/DatabaseService';
import { encrypt, decrypt } from '../utils/crypto';
import { Note } from '../types';
import { Scalar } from '@op-engineering/op-sqlite';

export const SyncService = {
  backupPath(): string {
    return `${RNFS.DocumentDirectoryPath}/secondbrain_backup.enc`;
  },

  async exportEncrypted(passphrase: string): Promise<void> {
    const db = getDb();
    const result = db.executeSync(`SELECT * FROM notes WHERE is_deleted = 0`);
    const notes = (result.rows ?? []).map((r: Record<string, Scalar>) => r as unknown as Note);
    const json = JSON.stringify({ version: 1, notes, exportedAt: Date.now() });
    const ciphertext = encrypt(json, passphrase);
    await RNFS.writeFile(this.backupPath(), ciphertext, 'utf8');
  },

  async importEncrypted(passphrase: string): Promise<{ imported: number; skipped: number }> {
    const exists = await RNFS.exists(this.backupPath());
    if (!exists) throw new Error('No backup file found at ' + this.backupPath());

    const ciphertext = await RNFS.readFile(this.backupPath(), 'utf8');
    const json = decrypt(ciphertext, passphrase);
    if (!json) throw new Error('Decryption failed — wrong passphrase?');

    const { notes } = JSON.parse(json) as { notes: Note[] };
    const db = getDb();
    let imported = 0;
    let skipped = 0;

    for (const note of notes) {
      const existing = db.executeSync(`SELECT updated_at FROM notes WHERE id = ?`, [note.id]);
      const existingRow = existing.rows?.[0];

      if (!existingRow) {
        db.executeSync(
          `INSERT INTO notes (id, title, body, body_preview, created_at, updated_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [note.id, note.title, note.body, note.body_preview, note.created_at, note.updated_at, note.is_deleted],
        );
        imported++;
      } else if ((existingRow.updated_at as number) < note.updated_at) {
        db.executeSync(
          `UPDATE notes SET title=?, body=?, body_preview=?, updated_at=?, is_deleted=? WHERE id=?`,
          [note.title, note.body, note.body_preview, note.updated_at, note.is_deleted, note.id],
        );
        imported++;
      } else {
        skipped++;
      }
    }

    return { imported, skipped };
  },

  async getBackupInfo(): Promise<{ exists: boolean; size: number; mtime: Date | null }> {
    const path = this.backupPath();
    const exists = await RNFS.exists(path);
    if (!exists) return { exists: false, size: 0, mtime: null };
    const stat = await RNFS.stat(path);
    return { exists: true, size: stat.size, mtime: new Date(stat.mtime) };
  },
};
