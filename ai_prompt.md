Here's the focused AI-only prompt:

---

# Second Brain — AI Feature Prompt (Gemini 1.5 Flash)

You are an expert React Native (CLI, bare workflow) + TypeScript developer. Implement **only the AI layer** of the Second Brain note app. Everything below is the complete spec.

---

## Core Rule
AI is **100% optional**. If no API key is set, all AI calls silently return `null` and the app continues normally. Never block the UI, never show errors to the user.

---

## AI Flow

```
User wants AI features
        ↓
[API Key set in Settings?]
        │
   ┌────┴────┐
   │         │
  Yes        No
   │         │
   ↓         ↓
AI works   Show "Get free key →" button
           → opens aistudio.google.com in browser
```

---

## Settings Screen — AI Section Only

### When no key is set:
```
┌─────────────────────────────┐
│  🤖 AI ASSISTANT            │
│  ───────────────────────    │
│  Gemini API Key             │
│                             │
│  [Enter key... AIza...]     │
│                             │
│  Don't have a key?          │
│  [Get free key →] 🔗        │
│  (aistudio.google.com)      │
│                             │
│  * Key is stored only       │
│    on your device           │
└─────────────────────────────┘
```

### When key is set:
```
┌─────────────────────────────┐
│  🤖 AI ASSISTANT            │
│  ───────────────────────    │
│  ✅ AI is active            │
│  AIza1234••••••••           │
│  [Change key]               │
└─────────────────────────────┘
```

---

## Files to Implement

```
src/
├── services/
│   └── AIService.ts
├── hooks/
│   └── useAI.ts
├── components/
│   ├── AISummaryCard.tsx
│   └── AITagSuggestions.tsx
└── screens/
    └── SettingsScreen.tsx   ← AI section only
```

---

## AIService.ts — Full Implementation

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Store } from '../store/mmkv';

class AIService {

  // Check if AI is usable
  isAvailable(): boolean {
    return Store.hasGeminiApiKey();
  }

  // Core caller — returns null silently on any failure
  private async callGemini(prompt: string): Promise<string | null> {
    const apiKey = Store.getGeminiApiKey();
    if (!apiKey) return null;

    try {
      const client = new GoogleGenerativeAI(apiKey);
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text();

    } catch (err: any) {
      if (err?.status === 429) {
        // Rate limited — wait 10s, retry once
        await new Promise(r => setTimeout(r, 10_000));
        return this.callGemini(prompt);
      }
      console.warn('Gemini error:', err);
      return null; // silent fail
    }
  }

  // 1. Summarize note → 2 sentences
  async summarizeNote(title: string, body: string): Promise<string | null> {
    return this.callGemini(
      `Summarize this note in exactly 2 short sentences. Be specific, not generic. Return only the summary, no preamble.

Title: ${title}
Body: ${body.slice(0, 3000)}`
    );
  }

  // 2. Suggest tags → string[]
  async suggestTags(title: string, body: string): Promise<string[]> {
    const raw = await this.callGemini(
      `Suggest 3 to 5 short lowercase tags for this note.
Return ONLY a valid JSON array of strings, nothing else.
Example: ["productivity","habits","focus"]

Title: ${title}
Body: ${body.slice(0, 2000)}`
    );
    if (!raw) return [];
    try {
      const tags = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return Array.isArray(tags) ? tags.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  // 3. Re-rank FTS search results by semantic relevance
  async rankByRelevance(
    query: string,
    notes: Array<{ id: string; title: string; preview: string }>
  ): Promise<string[]> {
    if (!notes.length) return [];

    const list = notes
      .map((n, i) => `[${i}] ${n.title}: ${n.preview}`)
      .join('\n');

    const raw = await this.callGemini(
      `User searched: "${query}"

Note excerpts:
${list}

Return ONLY a JSON array of indexes sorted by relevance, most relevant first.
Example: [2,0,4,1,3]`
    );

    if (!raw) return notes.map(n => n.id);
    try {
      const indexes: number[] = JSON.parse(
        raw.replace(/```json|```/g, '').trim()
      );
      return indexes
        .filter(i => i >= 0 && i < notes.length)
        .map(i => notes[i].id);
    } catch {
      return notes.map(n => n.id);
    }
  }

  // 4. Ask AI about a specific note — Q&A
  async askAboutNote(
    question: string,
    title: string,
    body: string
  ): Promise<string | null> {
    return this.callGemini(
      `You are a helpful assistant. The user is asking about their personal note.

Note title: ${title}
Note content:
${body.slice(0, 4000)}

User question: ${question}

Answer concisely. If the note lacks enough info, say so.`
    );
  }
}

export const aiService = new AIService();
```

---

## useAI.ts Hook

```typescript
import { useState, useCallback } from 'react';
import { aiService } from '../services/AIService';

export function useAI() {
  const [summary, setSummary] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Called after note save
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

  // Called from "Ask AI" bottom sheet
  const askQuestion = useCallback(async (
    question: string,
    title: string,
    body: string
  ) => {
    if (!aiService.isAvailable()) return;
    setLoading(true);
    try {
      const result = await aiService.askAboutNote(question, title, body);
      setAnswer(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = () => {
    setSummary(null);
    setTags([]);
    setAnswer(null);
  };

  return { summary, tags, answer, loading, analyzeNote, askQuestion, reset };
}
```

---

## SettingsScreen.tsx — AI Section Only

```typescript
import React, { useState } from 'react';
import {
  View, Text, TextInput,
  TouchableOpacity, Linking, StyleSheet
} from 'react-native';
import { Store } from '../store/mmkv';

export function AISettingsSection() {
  const [savedKey, setSavedKey] = useState(Store.getGeminiApiKey());
  const [inputKey, setInputKey] = useState('');
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    Store.setGeminiApiKey(trimmed);
    setSavedKey(trimmed);
    setInputKey('');
    setEditing(false);
  };

  const handleGetKey = () => {
    Linking.openURL('https://aistudio.google.com/app/apikey');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🤖 AI Assistant</Text>

      {savedKey && !editing ? (
        // ── Key is set ──
        <View style={styles.card}>
          <Text style={styles.activeLabel}>✅ AI is active</Text>
          <Text style={styles.maskedKey}>
            {savedKey.slice(0, 8)}{'•'.repeat(8)}
          </Text>
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>Change key</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ── No key or editing ──
        <View style={styles.card}>
          {!savedKey && (
            <Text style={styles.desc}>
              Add a free Gemini API key to enable AI summaries,
              tag suggestions, and smart search.
            </Text>
          )}

          <TextInput
            value={inputKey}
            onChangeText={setInputKey}
            placeholder="AIza..."
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          {inputKey.length > 0 && (
            <TouchableOpacity onPress={handleSave} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Save Key</Text>
            </TouchableOpacity>
          )}

          {editing && (
            <TouchableOpacity
              onPress={() => { setEditing(false); setInputKey(''); }}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {/* Opens browser */}
          <TouchableOpacity onPress={handleGetKey} style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Don't have a key? Get free key →
            </Text>
          </TouchableOpacity>

          <Text style={styles.privacy}>
            🔒 Key is stored only on your device. Never transmitted.
          </Text>
          <Text style={styles.quota}>
            Free quota: 1,500 requests/day · 15/minute
          </Text>
        </View>
      )}
    </View>
  );
}
```

---

## EditorScreen — Wire AI After Save

```typescript
// Inside EditorScreen.tsx — after auto-save triggers:

const { summary, tags, loading, analyzeNote } = useAI();

const handleSave = async () => {
  await NoteService.updateNote(noteId, { title, body });
  await NoteService.parseAndSaveLinks(noteId, body);

  // AI runs only if key is set — otherwise skipped silently
  analyzeNote(title, body);
};

// Render below editor:
{loading && <ActivityIndicator />}
{summary && <AISummaryCard summary={summary} />}
{tags.length > 0 && (
  <AITagSuggestions
    tags={tags}
    onApply={(tag) => NoteService.addTag(noteId, tag)}
  />
)}
```

---

## SearchScreen — Wire AI Ranking

```typescript
// Inside SearchScreen.tsx:

const handleSearch = async (query: string) => {
  // 1. FTS5 search first (always works)
  const ftsResults = await SearchService.search(query);
  setResults(ftsResults);

  // 2. AI re-ranks if available (optional, non-blocking)
  if (aiService.isAvailable() && ftsResults.length > 1) {
    const rankedIds = await aiService.rankByRelevance(query, ftsResults);
    const reranked = rankedIds
      .map(id => ftsResults.find(n => n.id === id))
      .filter(Boolean);
    setResults(reranked);
    setAiRanked(true); // show "AI ranked" badge
  }
};
```

---

## npm Install

```bash
npm install @google/generative-ai
```

---

## Absolute Rules

- Never call AI on every keystroke — only on explicit save or user action
- Always check `aiService.isAvailable()` before any AI call
- API key never leaves the device — never log it, never send it to any server
- All AI functions return `null` or `[]` on failure — never throw to UI
- Rate limit hit (429) → wait 10s → retry once → then return null