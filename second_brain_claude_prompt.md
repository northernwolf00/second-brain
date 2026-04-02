# Second Brain — React Native App — Claude CLI Master Prompt

You are an expert React Native developer building a production-ready, offline-first note-taking and knowledge management app called **Second Brain**. The app works like Obsidian but is mobile-native, built with React Native CLI (bare workflow, not Expo).

---

## App overview

Second Brain is a privacy-first, offline-first note app where users:
- Write rich-text notes with `[[wikilink]]` syntax to link notes together
- Browse a visual knowledge graph showing how notes connect
- Search notes instantly using full-text search (SQLite FTS5)
- Get daily "resurface" notifications showing old notes
- (PRO) Get AI-generated summaries and tag suggestions via on-device LLM
- (PRO) Sync encrypted notes to iCloud or Google Drive

**Core principle**: Every feature works 100% offline. No feature ever blocks on a network call. SQLite is the source of truth. Sync is a background-only, optional PRO feature.

---

## Tech stack

### Foundation
- React Native CLI (bare workflow) — NOT Expo
- TypeScript throughout
- React Navigation (Stack + Bottom Tabs)
- Reanimated 3 for animations
- react-native-gesture-handler for touch

### Storage
- `@op-engineering/op-sqlite` — SQLite with FTS5 + JSON1 extensions (JSI, no bridge)
- `react-native-mmkv` — fast key-value store for preferences and UI state
- `react-native-fs` — filesystem access for attachments and model files

### Editor
- `10tap-editor` — Tiptap-based rich text editor for React Native
- Custom Tiptap extension for `[[wikilink]]` autocomplete and rendering

### Graph view
- `react-native-svg` — SVG rendering
- `d3-force` (headless, JS thread) — force-directed graph layout
- Pinch/pan via gesture-handler + Reanimated

### AI (PRO, on-device)
- `llama.rn` — llama.cpp bindings for React Native
- Model: Phi-3 Mini 4-bit quantized (GGUF, ~1.8GB), downloaded once on first PRO activation

### Sync (PRO)
- `expo-file-system` or `react-native-fs` for file upload
- `tweetnacl-js` for XSalsa20-Poly1305 E2E encryption
- iCloud (iOS) and Google Drive (Android) as storage backends

### Monetization
- `react-native-purchases` (RevenueCat) for subscriptions
- Free tier: unlimited notes, graph view, search
- PRO ($5.99/mo or $39.99/yr): AI features + encrypted sync

---

## SQLite schema

Create these tables on first app launch inside a `DatabaseService.ts`:

```sql
-- Core notes table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  body_preview TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  embedding_id TEXT
);

-- Wikilink graph edges
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  alias TEXT,
  created_at INTEGER NOT NULL
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  note_count INTEGER NOT NULL DEFAULT 0
);

-- Many-to-many: notes <-> tags
CREATE TABLE IF NOT EXISTS note_tags (
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  body,
  content=notes,
  content_rowid=id,
  tokenize='unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
END;

-- Sync changelog (PRO only)
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
  synced_at INTEGER,
  checksum TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_links_source   ON links(source_id);
CREATE INDEX IF NOT EXISTS idx_links_target   ON links(target_id);
```

---

## Project file structure

```
SecondBrain/
├── android/
├── ios/
├── src/
│   ├── db/
│   │   ├── DatabaseService.ts      # open DB, run migrations, expose instance
│   │   ├── schema.sql              # SQL above as a string constant
│   │   └── migrations/             # versioned migration files
│   ├── services/
│   │   ├── NoteService.ts          # CRUD for notes + wikilink parsing
│   │   ├── GraphEngine.ts          # build node/edge lists from links table
│   │   ├── SearchService.ts        # FTS5 queries with bm25 ranking
│   │   ├── AIService.ts            # llama.rn wrapper: summarize, tag, search
│   │   └── SyncService.ts          # PRO: encrypt + upload to cloud
│   ├── screens/
│   │   ├── HomeScreen.tsx          # recent notes list
│   │   ├── EditorScreen.tsx        # rich text editor with wikilinks
│   │   ├── GraphScreen.tsx         # SVG knowledge graph
│   │   ├── SearchScreen.tsx        # FTS5 search UI
│   │   ├── DailyResurfaceScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── components/
│   │   ├── NoteCard.tsx
│   │   ├── WikilinkChip.tsx
│   │   ├── GraphNode.tsx
│   │   ├── GraphEdge.tsx
│   │   └── TagPill.tsx
│   ├── hooks/
│   │   ├── useNotes.ts
│   │   ├── useGraph.ts
│   │   ├── useSearch.ts
│   │   └── useAI.ts
│   ├── store/
│   │   └── mmkv.ts                 # MMKV instance + typed getters/setters
│   ├── navigation/
│   │   └── RootNavigator.tsx
│   └── utils/
│       ├── wikilinkParser.ts       # parse [[...]] from note body
│       ├── crypto.ts               # tweetnacl helpers
│       └── uuid.ts
├── App.tsx
└── package.json
```

---

## Build order — implement in this exact sequence

### Phase 1 — Core (offline, free tier)

**Step 1: DatabaseService**
- Open SQLite database at app start using op-sqlite
- Run schema creation SQL
- Implement version-based migrations
- Export a singleton `db` instance

**Step 2: NoteService**
- `createNote(title, body): Promise<Note>`
- `updateNote(id, fields): Promise<void>`
- `deleteNote(id): Promise<void>` (soft delete: set is_deleted=1)
- `getNoteById(id): Promise<Note>`
- `getAllNotes(): Promise<Note[]>` (exclude deleted, order by updated_at DESC)
- `parseAndSaveLinks(noteId, body): Promise<void>` — extract all `[[...]]`, resolve to note IDs, upsert links table

**Step 3: Rich text editor screen**
- Use 10tap-editor
- Implement custom Tiptap extension: detect `[[` → show autocomplete dropdown querying SQLite → on select, insert wikilink node
- On save, call `NoteService.parseAndSaveLinks()`
- Auto-save every 2 seconds of inactivity

**Step 4: GraphEngine + GraphScreen**
- `buildGraph(): Promise<{nodes: Node[], edges: Edge[]}>` — query notes + links tables
- Run d3-force simulation on JS thread to get x/y positions
- Render with react-native-svg: circles for nodes, lines for edges
- Gesture-handler: pinch to zoom, pan, tap node to open note

**Step 5: SearchService + SearchScreen**
- `search(query: string): Promise<SearchResult[]>`
- SQL: `SELECT notes.*, snippet(notes_fts, 1, '<b>', '</b>', '…', 10) as excerpt FROM notes_fts JOIN notes ON notes.id = notes_fts.rowid WHERE notes_fts MATCH ? ORDER BY bm25(notes_fts) LIMIT 30`
- Debounce input by 200ms
- Show title + highlighted excerpt per result

**Step 6: Daily resurface**
- On app launch, pick 1 random note updated more than 30 days ago
- Schedule a local notification for 9am daily using `@notifee/react-native`
- Notification deep-links to that note in EditorScreen

### Phase 2 — Monetization

**Step 7: RevenueCat paywall**
- Set up `react-native-purchases`
- Gate AIService and SyncService behind PRO entitlement check
- Build a paywall screen: show free vs PRO features, monthly + annual options

### Phase 3 — PRO features

**Step 8: AIService (on-device)**
- Initialize llama.rn with Phi-3 Mini GGUF on first PRO activation
- `summarizeNote(body: string): Promise<string>` — prompt: "Summarize this note in 2 sentences: {body}"
- `suggestTags(body: string): Promise<string[]>` — prompt: "Suggest 3-5 short tags for this note as JSON array: {body}"
- `semanticSearch(query: string, noteIds: string[]): Promise<string[]>` — rank notes by relevance using embeddings

**Step 9: SyncService (encrypted)**
- On sync trigger: serialize all non-deleted notes to JSON
- Encrypt with tweetnacl XSalsa20-Poly1305, key = Argon2id(userPassphrase)
- Upload encrypted blob to iCloud (iOS) or Google Drive (Android)
- On restore: download, decrypt, merge with local (last-write-wins using updated_at)

---

## Key implementation details

### Wikilink parser (wikilinkParser.ts)
```typescript
export function extractWikilinks(body: string): string[] {
  const regex = /\[\[([^\[\]]+)\]\]/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}
```

### NoteService.parseAndSaveLinks
```typescript
async parseAndSaveLinks(noteId: string, body: string): Promise<void> {
  const titles = extractWikilinks(body);
  // delete old links from this note
  await db.execute('DELETE FROM links WHERE source_id = ?', [noteId]);
  for (const title of titles) {
    // find or create target note
    const existing = await db.execute(
      'SELECT id FROM notes WHERE title = ? AND is_deleted = 0 LIMIT 1',
      [title]
    );
    const targetId = existing.rows[0]?.id ?? await createNote(title, '');
    await db.execute(
      'INSERT OR IGNORE INTO links (id, source_id, target_id, created_at) VALUES (?, ?, ?, ?)',
      [uuid(), noteId, targetId, Date.now()]
    );
  }
}
```

### MMKV store (store/mmkv.ts)
```typescript
import { MMKV } from 'react-native-mmkv';
export const storage = new MMKV();

export const Store = {
  getLastOpenedNoteId: () => storage.getString('lastOpenedNoteId'),
  setLastOpenedNoteId: (id: string) => storage.set('lastOpenedNoteId', id),
  getTheme: () => storage.getString('theme') ?? 'system',
  setTheme: (t: string) => storage.set('theme', t),
  isProUser: () => storage.getBoolean('isPro') ?? false,
  setProUser: (v: boolean) => storage.set('isPro', v),
};
```

---

## Coding standards

- All async DB calls wrapped in try/catch, errors logged and surfaced via a global error boundary
- No `any` types — define interfaces for Note, Link, Tag, SearchResult, GraphNode, GraphEdge
- Services are plain TypeScript classes with static methods — no React inside services
- Hooks (`useNotes`, `useSearch`, etc.) are the only place that connects services to React state
- All SQLite queries use parameterized statements — never string interpolation
- Soft-delete only — never hard DELETE from notes table (needed for sync conflict resolution)

---

## What to build first when I give you a step

When I say "build step N", you will:
1. Write the complete TypeScript file(s) for that step
2. Include all imports
3. Show where the file lives in the project structure
4. Note any `npm install` commands needed
5. Show a minimal usage example (e.g. how a screen calls the service)

Start with: **"Build Step 1 — DatabaseService"**
