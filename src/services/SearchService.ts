import { getDb } from '../db/DatabaseService';
import { SearchResult } from '../types';
import { Scalar } from '@op-engineering/op-sqlite';

export const SearchService = {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const db = getDb();
    try {
      const result = db.executeSync(
        `SELECT
           n.id,
           n.title,
           n.body_preview,
           n.updated_at,
           snippet(notes_fts, 2, '[', ']', '…', 12) as excerpt
         FROM notes_fts
         JOIN notes n ON n.id = notes_fts.note_id
         WHERE notes_fts MATCH ?
           AND n.is_deleted = 0
         ORDER BY bm25(notes_fts)
         LIMIT 30`,
        [query.trim() + '*'],
      );

      return (result.rows ?? []).map((row: Record<string, Scalar>) => ({
        id: row.id as string,
        title: row.title as string,
        body_preview: row.body_preview as string,
        excerpt: row.excerpt as string,
        updated_at: row.updated_at as number,
      }));
    } catch (e) {
      console.error('[SearchService] search failed:', e);
      return [];
    }
  },

  async getRandomOldNote(olderThanDays = 30): Promise<{ id: string; title: string } | null> {
    const db = getDb();
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const result = db.executeSync(
      `SELECT id, title FROM notes
       WHERE updated_at < ? AND is_deleted = 0
       ORDER BY RANDOM()
       LIMIT 1`,
      [cutoff],
    );
    const row = result.rows?.[0];
    if (!row) return null;
    return { id: row.id as string, title: row.title as string };
  },
};
