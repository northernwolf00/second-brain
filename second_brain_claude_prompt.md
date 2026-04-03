# Second Brain — React Native App — Claude CLI Master Prompt
# AI powered by Gemini 1.5 Flash (FREE — Google AI Studio)

You are an expert React Native developer building a production-ready, offline-first note-taking and knowledge management app called **Second Brain**. The app works like Obsidian but is mobile-native, built with React Native CLI (bare workflow, not Expo).

---

## App overview

Second Brain is a privacy-first, offline-first note app where users:
- Write rich-text notes with `[[wikilink]]` syntax to link notes together
- Browse a visual knowledge graph showing how notes connect
- Search notes instantly using full-text search (SQLite FTS5)
- Get daily "resurface" notifications showing old notes
- (PRO) Get AI-generated summaries, tag suggestions, and smart search via **Gemini 1.5 Flash API** (free tier)
- (PRO) Sync encrypted notes to iCloud or Google Drive

**Core principle**: Every feature works 100% offline. No feature ever blocks on a network call. SQLite is the source of truth. AI features degrade gracefully when offline (skip silently, retry when connected). Sync is a background-only, optional PRO feature.

---

## AI Strategy — Gemini 1.5 Flash (FREE)

### Why Gemini 1.5 Flash
- **Cost**: 100% free up to 15 requests/min and 1,500 requests/day — plenty for a note app
- **Speed**: Responses in ~1–2 seconds, feels instant for summarization
- **Quality**: Far better than any on-device model at this size
- **Simplicity**: One HTTP call, no model files to bundle, no device RAM concerns

### Free tier limits and how we handle them
| Limit | Value | Our strategy |
|---|---|---|
| Requests/minute | 15 | Queue + debounce AI calls, never fire on every keystroke |
| Requests/day | 1,500 | Only call AI on explicit user action (save button, tag button) |
| Input tokens | 1M | No issue for notes |
| Output tokens | 8,192 | No issue for summaries/tags |

### Rate limit handling pattern
```typescript
// AIService queues requests and retries on 429
const queue: Array<() => Promise<void>> = [];
let requestsThisMinute = 0;

setInterval(() => { requestsThisMinute = 0; }, 60_000);

async function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  if (requestsThisMinute >= 14) {
    await new Promise(r => setTimeout(r, 5000)); // wait 5s, retry
  }
  requestsThisMinute++;
  return fn();
}
```

### API key storage
- User enters their free Gemini API key once in Settings
- Stored securely in MMKV (never sent to our servers)
- Get key at: https://aistudio.google.com/app/apikey (free, no credit card)

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
- `react-native-mmkv` — fast key-value store for preferences, UI state, and API key
- `react-native-fs` — filesystem access for attachments

### Editor
- `10tap-editor` — Tiptap-based rich text editor for React Native
- Custom Tiptap extension for `[[wikilink]]` autocomplete and rendering

### Graph view
- `react-native-svg` — SVG rendering
- `d3-force` (headless, JS thread) — force-directed graph layout
- Pinch/pan via gesture-handler + Reanimated

### AI — Gemini 1.5 Flash (FREE)
- `@google/generative-ai` — official Google Generative AI SDK
- Model: `gemini-1.5-flash` via REST API
- User supplies their own free API key from Google AI Studio
- All AI calls are non-blocking — app works perfectly without them

### Sync (PRO)
- `react-native-fs` for file upload/download
- `tweetnacl-js` for XSalsa20-Poly1305 E2E encryption
- iCloud (iOS) and Google Drive (Android) as storage backends

### Monetization
- `react-native-purchases` (RevenueCat) for subscriptions
- Free tier: unlimited notes, graph view, FTS search, daily resurface
- PRO ($4.99/mo or $29.99/yr): Gemini AI features + encrypted sync

---

## SQLite schema

Create these tables on first app launch inside `DatabaseService.ts`:

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
  ai_summary TEXT,
  ai_tags TEXT
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

-- Triggers to keep FTS in sync automatically
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

## AIService.ts — full implementation pattern

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from '../store/mmkv';

class AIService {
  private getClient(): GoogleGenerativeAI | null {
    const apiKey = storage.getString('geminiApiKey');
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
  }

  private async callGemini(prompt: string): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null; // no key = silently skip

    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      if (err?.status === 429) {
        // rate limited — wait 10s and retry once
        await new Promise(r => setTimeout(r, 10_000));
        return this.callGemini(prompt);
      }
      console.warn('Gemini error:', err);
      return null;
    }
  }

  // Auto-summary: called after user saves a note
  async summarizeNote(title: string, body: string): Promise<string | null> {
    const prompt = `Summarize this note in exactly 2 short sentences. Be specific, not generic. Return only the summary, no preamble.

Title: ${title}
Body: ${body.slice(0, 3000)}`;

    return this.callGemini(prompt);
  }

  // Tag suggestions: returns up to 5 tags
  async suggestTags(title: string, body: string): Promise<string[]> {
    const prompt = `Suggest 3 to 5 short, lowercase tags for this note. Return ONLY a valid JSON array of strings, nothing else. Example: ["productivity","habits","stoicism"]

Title: ${title}
Body: ${body.slice(0, 2000)}`;

    const raw = await this.callGemini(prompt);
    if (!raw) return [];

    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const tags = JSON.parse(cleaned);
      return Array.isArray(tags) ? tags.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  // Smart search: re-ranks FTS results by semantic relevance
  async rankByRelevance(
    query: string,
    notes: Array<{ id: string; title: string; preview: string }>
  ): Promise<string[]> {
    if (notes.length === 0) return [];

    const noteList = notes
      .map((n, i) => `[${i}] ${n.title}: ${n.preview}`)
      .join('\n');

    const prompt = `A user searched for: "${query}"

Here are note excerpts numbered by index:
${noteList}

Return ONLY a JSON array of the indexes sorted by relevance to the query, most relevant first. Example: [2,0,4,1,3]`;

    const raw = await this.callGemini(prompt);
    if (!raw) return notes.map(n => n.id); // fallback: original order

    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const indexes: number[] = JSON.parse(cleaned);
      return indexes
        .filter(i => i >= 0 && i < notes.length)
        .map(i => notes[i].id);
    } catch {
      return notes.map(n => n.id);
    }
  }

  // Ask AI about a specific note — conversational Q&A
  async askAboutNote(
    question: string,
    title: string,
    body: string
  ): Promise<string | null> {
    const prompt = `You are a helpful assistant. The user is asking about their personal note.

Note title: ${title}
Note content:
${body.slice(0, 4000)}

User question: ${question}

Answer concisely and helpfully. If the note doesn't contain enough info, say so.`;

    return this.callGemini(prompt);
  }

  // Check if AI is available (key set + online)
  isAvailable(): boolean {
    return !!storage.getString('geminiApiKey');
  }
}

export const aiService = new AIService();
```

---

## Project file structure

```
SecondBrain/
├── android/
├── ios/
├── src/
│   ├── db/
│   │   ├── DatabaseService.ts      # open DB, run schema, export singleton
│   │   └── schema.ts               # SQL schema as string constant
│   ├── services/
│   │   ├── NoteService.ts          # CRUD + wikilink parsing
│   │   ├── GraphEngine.ts          # build node/edge lists from links table
│   │   ├── SearchService.ts        # FTS5 queries with bm25 ranking
│   │   ├── AIService.ts            # Gemini 1.5 Flash: summarize, tags, search, Q&A
│   │   └── SyncService.ts          # PRO: encrypt + upload to cloud
│   ├── screens/
│   │   ├── HomeScreen.tsx          # recent notes list
│   │   ├── EditorScreen.tsx        # rich text editor + AI panel
│   │   ├── GraphScreen.tsx         # SVG knowledge graph
│   │   ├── SearchScreen.tsx        # FTS5 + AI semantic search
│   │   ├── DailyResurfaceScreen.tsx
│   │   └── SettingsScreen.tsx      # API key input + PRO management
│   ├── components/
│   │   ├── NoteCard.tsx
│   │   ├── WikilinkChip.tsx
│   │   ├── GraphNode.tsx
│   │   ├── GraphEdge.tsx
│   │   ├── TagPill.tsx
│   │   ├── AISummaryCard.tsx       # shows Gemini summary below editor
│   │   └── AITagSuggestions.tsx    # one-tap tag chips from Gemini
│   ├── hooks/
│   │   ├── useNotes.ts
│   │   ├── useGraph.ts
│   │   ├── useSearch.ts
│   │   └── useAI.ts               # wraps AIService, handles loading/error state
│   ├── store/
│   │   └── mmkv.ts                # MMKV instance + typed getters/setters
│   ├── navigation/
│   │   └── RootNavigator.tsx
│   └── utils/
│       ├── wikilinkParser.ts
│       ├── crypto.ts
│       └── uuid.ts
├── App.tsx
└── package.json
```

---

## Build order — implement in this exact sequence

### Phase 1 — Core (offline, free tier)

**Step 1: DatabaseService**
- Open SQLite with op-sqlite on app start
- Run full schema SQL
- Version-based migrations (store schema version in MMKV)
- Export singleton `db`

**Step 2: NoteService**
- `createNote(title, body): Promise<Note>`
- `updateNote(id, fields): Promise<void>`
- `deleteNote(id): Promise<void>` — soft delete (is_deleted = 1)
- `getNoteById(id): Promise<Note>`
- `getAllNotes(): Promise<Note[]>` — exclude deleted, order by updated_at DESC
- `parseAndSaveLinks(noteId, body): Promise<void>` — parse `[[...]]`, upsert links table

**Step 3: Rich text editor (EditorScreen)**
- 10tap-editor with custom wikilink extension
- `[[` triggers autocomplete dropdown → query SQLite titles → insert wikilink node
- Auto-save after 2 seconds of inactivity
- On save: call `NoteService.parseAndSaveLinks()` then trigger AI (if key set)

**Step 4: GraphEngine + GraphScreen**
- `buildGraph()` → query notes + links tables → return nodes + edges
- d3-force simulation on JS thread → x/y positions
- react-native-svg renders: circles for nodes, lines for edges
- Pinch to zoom, pan, tap to open note

**Step 5: SearchService + SearchScreen**
- FTS5 query with bm25 ranking + snippet() for excerpts
- 200ms debounce on input
- If PRO + AI available: after FTS results load, call `aiService.rankByRelevance()` to re-sort

**Step 6: Daily resurface + notifications**
- Pick 1 random note updated 30+ days ago
- Schedule local notification at 9am daily via `@notifee/react-native`
- Deep link to EditorScreen

### Phase 2 — Monetization

**Step 7: RevenueCat paywall**
- Gate AIService calls behind PRO entitlement check
- Settings screen: API key input field (stored in MMKV) + paywall trigger
- Show "AI powered by Gemini" badge in PRO features list

### Phase 3 — PRO features

**Step 8: AIService + UI integration**
Install: `npm install @google/generative-ai`

Wire into EditorScreen:
- After save → `aiService.summarizeNote()` → store in `notes.ai_summary` → show `AISummaryCard`
- After save → `aiService.suggestTags()` → show `AITagSuggestions` chips → user taps to apply
- Add "Ask AI" button → bottom sheet with text input → `aiService.askAboutNote()`

Wire into SearchScreen:
- After FTS results → `aiService.rankByRelevance()` → re-render sorted results
- Show "AI ranked" badge when active

**Step 9: SyncService (encrypted)**
- Serialize all non-deleted notes to JSON
- Encrypt with tweetnacl, key = Argon2id(passphrase)
- Upload encrypted blob to iCloud / Google Drive
- Restore: download → decrypt → merge (last-write-wins on updated_at)

---

## Key implementation snippets

### wikilinkParser.ts
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

### useAI.ts hook
```typescript
import { useState, useCallback } from 'react';
import { aiService } from '../services/AIService';

export function useAI() {
  const [summary, setSummary] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const analyzeNote = useCallback(async (title: string, body: string) => {
    if (!aiService.isAvailable()) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        aiService.summarizeNote(title, body),
        aiService.suggestTags(title, body),
      ]);
      setSummary(s);
      setTags(t);
    } finally {
      setLoading(false);
    }
  }, []);

  return { summary, tags, loading, analyzeNote };
}
```

### MMKV store with API key
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

  // Gemini API key — stored only on device, never transmitted
  getGeminiApiKey: () => storage.getString('geminiApiKey') ?? '',
  setGeminiApiKey: (key: string) => storage.set('geminiApiKey', key),
  hasGeminiApiKey: () => !!storage.getString('geminiApiKey'),
};
```

### SettingsScreen — API key setup UI
```typescript
// In SettingsScreen.tsx — API key section
<View>
  <Text style={styles.label}>Gemini API Key (free)</Text>
  <Text style={styles.hint}>
    Get your free key at aistudio.google.com — no credit card needed.
    Stored only on your device.
  </Text>
  <TextInput
    value={apiKey}
    onChangeText={setApiKey}
    placeholder="AIza..."
    secureTextEntry
    autoCapitalize="none"
    onEndEditing={() => Store.setGeminiApiKey(apiKey)}
  />
  <Text style={styles.quota}>Free quota: 1,500 requests/day · 15/minute</Text>
</View>
```

---

## Coding standards

- All async DB calls wrapped in try/catch, errors logged via a global error boundary
- No `any` types — define interfaces for Note, Link, Tag, SearchResult, GraphNode, GraphEdge
- Services are plain TypeScript classes/singletons — no React inside services
- Hooks are the only bridge between services and React state
- All SQLite queries use parameterized statements — never string interpolation
- Soft-delete only — never hard DELETE from notes (needed for sync conflict resolution)
- AI calls are always optional — every call site checks `aiService.isAvailable()` first
- Never call AI on every keystroke — only on explicit save or user action
- API key never leaves the device — never log it, never send it to any backend

---

## npm install commands (all at once)

```bash
npm install @react-navigation/native @react-navigation/stack \
  react-native-screens react-native-safe-area-context \
  react-native-gesture-handler react-native-reanimated \
  react-native-svg react-native-mmkv \
  @op-engineering/op-sqlite \
  react-native-fs \
  @google/generative-ai \
  @notifee/react-native \
  react-native-purchases \
  tweetnacl
```

---

## What to build first when I give you a step

When I say "build step N", you will:
1. Write the complete TypeScript file(s) for that step
2. Include all imports
3. Show where the file lives in the project structure
4. Note any additional `npm install` commands if needed for that step
5. Show a minimal usage example (how a screen calls the service)
6. For AI steps: show the exact Gemini prompt strings used

Start with: **"Build Step 1 — DatabaseService"**