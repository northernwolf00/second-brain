import { open, DB } from '@op-engineering/op-sqlite';
import { SCHEMA_STATEMENTS, DB_VERSION } from './schema';

let _db: DB | null = null;

export function getDb(): DB {
  if (!_db) throw new Error('Database not initialized. Call DatabaseService.init() first.');
  return _db;
}

export const DatabaseService = {
  async init(): Promise<void> {
    try {
      _db = open({ name: 'secondbrain.db' });
      this.runSchema();
      this.runMigrations();
    } catch (e) {
      console.error('[DatabaseService] init failed:', e);
      throw e;
    }
  },

  runSchema(): void {
    const db = getDb();
    for (const sql of SCHEMA_STATEMENTS) {
      db.executeSync(sql);
    }
  },

  runMigrations(): void {
    const db = getDb();
    db.executeSync(`CREATE TABLE IF NOT EXISTS db_meta (key TEXT PRIMARY KEY, value TEXT);`);

    const result = db.executeSync(`SELECT value FROM db_meta WHERE key = 'version';`);
    const currentVersion = result.rows?.[0]?.value
      ? parseInt(result.rows[0].value as string, 10)
      : 0;

    if (currentVersion < 2) {
      // v2: rebuild FTS5 with note_id TEXT column — fixes UUID datatype mismatch on insert
      db.executeSync(`DROP TABLE IF EXISTS notes_fts`);
      db.executeSync(`DROP TRIGGER IF EXISTS notes_ai`);
      db.executeSync(`DROP TRIGGER IF EXISTS notes_au`);
      db.executeSync(`DROP TRIGGER IF EXISTS notes_ad`);
      // SCHEMA_STATEMENTS[4] = FTS5 table, [5][6][7] = triggers
      for (const sql of SCHEMA_STATEMENTS.slice(4, 8)) {
        db.executeSync(sql);
      }
      // Backfill existing notes into the new FTS table
      db.executeSync(
        `INSERT INTO notes_fts(note_id, title, body) SELECT id, title, body FROM notes WHERE is_deleted = 0`,
      );
    }

    if (currentVersion < DB_VERSION) {
      db.executeSync(
        `INSERT OR REPLACE INTO db_meta (key, value) VALUES ('version', ?);`,
        [String(DB_VERSION)],
      );
    }
  },

  close(): void {
    if (_db) {
      _db.close();
      _db = null;
    }
  },
};
