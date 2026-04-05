import { getDb } from '../db/DatabaseService';
import { Note } from '../types';
import { uuid } from '../utils/uuid';
import { extractWikilinks } from '../utils/wikilinkParser';
import { Scalar } from '@op-engineering/op-sqlite';

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')   // strip tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function makePreview(body: string): string {
  return htmlToPlainText(body).replace(/\[\[.*?\]\]/g, '').slice(0, 200);
}

function rowToNote(row: Record<string, Scalar>): Note {
  return {
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    body_preview: row.body_preview as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    is_deleted: row.is_deleted as 0 | 1,
    embedding_id: row.embedding_id as string | undefined,
  };
}

export const NoteService = {
  async createNote(title: string, body: string): Promise<Note> {
    const db = getDb();
    const id = uuid();
    const now = Date.now();
    const preview = makePreview(body);

    db.executeSync(
      `INSERT INTO notes (id, title, body, body_preview, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, title, body, preview, now, now],
    );

    await this.parseAndSaveLinks(id, body);
    this.logSync(id, 'INSERT');

    return { id, title, body, body_preview: preview, created_at: now, updated_at: now, is_deleted: 0 };
  },

  async updateNote(id: string, fields: Partial<Pick<Note, 'title' | 'body'>>): Promise<void> {
    const db = getDb();
    const now = Date.now();
    const sets: string[] = ['updated_at = ?'];
    const values: Scalar[] = [now];

    if (fields.title !== undefined) {
      sets.push('title = ?');
      values.push(fields.title);
    }
    if (fields.body !== undefined) {
      sets.push('body = ?');
      values.push(fields.body);
      sets.push('body_preview = ?');
      values.push(makePreview(fields.body));
    }

    values.push(id);
    db.executeSync(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, values);

    if (fields.body !== undefined) {
      await this.parseAndSaveLinks(id, fields.body);
    }
    this.logSync(id, 'UPDATE');
  },

  async deleteNote(id: string): Promise<void> {
    const db = getDb();
    db.executeSync(`UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?`, [Date.now(), id]);
    this.logSync(id, 'DELETE');
  },

  async getNoteById(id: string): Promise<Note | null> {
    const db = getDb();
    const result = db.executeSync(
      `SELECT * FROM notes WHERE id = ? AND is_deleted = 0`,
      [id],
    );
    const row = result.rows?.[0];
    return row ? rowToNote(row) : null;
  },

  async getAllNotes(): Promise<Note[]> {
    const db = getDb();
    const result = db.executeSync(
      `SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC`,
    );
    return (result.rows ?? []).map(rowToNote);
  },

  async searchTitles(query: string): Promise<Note[]> {
    const db = getDb();
    const result = db.executeSync(
      `SELECT * FROM notes WHERE title LIKE ? AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 20`,
      [`%${query}%`],
    );
    return (result.rows ?? []).map(rowToNote);
  },

  async parseAndSaveLinks(noteId: string, body: string): Promise<void> {
    const db = getDb();
    const titles = extractWikilinks(body);

    db.executeSync(`DELETE FROM links WHERE source_id = ?`, [noteId]);

    for (const title of titles) {
      const existing = db.executeSync(
        `SELECT id FROM notes WHERE title = ? AND is_deleted = 0 LIMIT 1`,
        [title],
      );
      let targetId = existing.rows?.[0]?.id as string | undefined;

      if (!targetId) {
        const newNote = await this.createNote(title, '');
        targetId = newNote.id;
      }

      db.executeSync(
        `INSERT OR IGNORE INTO links (id, source_id, target_id, created_at) VALUES (?, ?, ?, ?)`,
        [uuid(), noteId, targetId, Date.now()],
      );
    }
  },

  async getBacklinks(noteId: string): Promise<Note[]> {
    const db = getDb();
    const result = db.executeSync(
      `SELECT n.* FROM notes n
       JOIN links l ON l.source_id = n.id
       WHERE l.target_id = ? AND n.is_deleted = 0`,
      [noteId],
    );
    return (result.rows ?? []).map(rowToNote);
  },

  logSync(noteId: string, operation: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    try {
      const db = getDb();
      db.executeSync(
        `INSERT INTO sync_log (id, note_id, operation) VALUES (?, ?, ?)`,
        [uuid(), noteId, operation],
      );
    } catch {
      // Non-fatal
    }
  },
};
