import { Store } from '../store/mmkv';

const GEMINI_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 30_000;

let requestsThisMinute = 0;
setInterval(() => { requestsThisMinute = 0; }, 60_000);

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = await Store.getGeminiApiKey();
  if (!apiKey) return null;

  if (requestsThisMinute >= 14) {
    await new Promise(r => setTimeout(r, 5000));
  }
  requestsThisMinute++;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log('[AIService] sending request...');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json();

    if (!res.ok) {
      console.warn('[AIService] API error:', json?.error?.message ?? res.status);
      if (res.status === 429) {
        // Respect the retry delay from the error message if present
        const retryMatch = json?.error?.message?.match(/retry in ([\d.]+)s/i);
        const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) * 1000 + 500 : 10_000;
        console.log(`[AIService] rate limited, retrying in ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        return callGemini(prompt);
      }
      return null;
    }

    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    console.log('[AIService] got response:', text?.slice(0, 80));
    return text ?? null;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      console.warn('[AIService] request timed out after', TIMEOUT_MS, 'ms');
    } else {
      console.warn('[AIService] fetch error:', err?.message ?? err);
    }
    return null;
  }
}

export const AIService = {
  async isAvailable(): Promise<boolean> {
    const key = await Store.getGeminiApiKey();
    return !!key;
  },

  async summarizeNote(title: string, body: string): Promise<string | null> {
    return callGemini(
      `Summarize this note in exactly 2 short sentences. Be specific, not generic. Return only the summary, no preamble.\n\nTitle: ${title}\nBody: ${body.slice(0, 3000)}`
    );
  },

  async suggestTags(title: string, body: string): Promise<string[]> {
    const raw = await callGemini(
      `Suggest 3 to 5 short, lowercase tags for this note. Return ONLY a valid JSON array of strings, nothing else. Example: ["productivity","habits","stoicism"]\n\nTitle: ${title}\nBody: ${body.slice(0, 2000)}`
    );
    if (!raw) return [];
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const tags = JSON.parse(cleaned);
      return Array.isArray(tags) ? tags.slice(0, 5) : [];
    } catch {
      return [];
    }
  },

  async rankByRelevance(
    query: string,
    notes: Array<{ id: string; title: string; preview: string }>
  ): Promise<string[]> {
    if (notes.length === 0) return [];
    const noteList = notes.map((n, i) => `[${i}] ${n.title}: ${n.preview}`).join('\n');
    const raw = await callGemini(
      `A user searched for: "${query}"\n\nHere are note excerpts numbered by index:\n${noteList}\n\nReturn ONLY a JSON array of the indexes sorted by relevance to the query, most relevant first. Example: [2,0,4,1,3]`
    );
    if (!raw) return notes.map(n => n.id);
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const indexes: number[] = JSON.parse(cleaned);
      return indexes.filter(i => i >= 0 && i < notes.length).map(i => notes[i].id);
    } catch {
      return notes.map(n => n.id);
    }
  },

  async askAboutNote(question: string, title: string, body: string): Promise<string | null> {
    return callGemini(
      `You are a helpful assistant. The user is asking about their personal note.\n\nNote title: ${title}\nNote content:\n${body.slice(0, 4000)}\n\nUser question: ${question}\n\nAnswer concisely and helpfully. If the note doesn't contain enough info, say so.`
    );
  },

  async chat(
    message: string,
    history: Array<{ role: 'user' | 'ai'; text: string }>,
  ): Promise<string | null> {
    const historyText = history
      .slice(-10) // keep last 10 turns for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n');

    return callGemini(
      `You are a helpful personal knowledge assistant for a note-taking app called Second Brain. You help users think, write, brainstorm, and organize their ideas. Be concise, warm, and useful.\n\n${historyText ? `Conversation so far:\n${historyText}\n\n` : ''}User: ${message}\n\nAssistant:`
    );
  },

  async improveText(text: string): Promise<string | null> {
    return callGemini(
      `Improve the following note text. Make it clearer and more concise. Return ONLY the improved text, no explanation.\n\n${text.slice(0, 3000)}`
    );
  },

  async expandIdea(text: string): Promise<string | null> {
    return callGemini(
      `Expand the following idea into a more detailed note with structure and bullet points where helpful. Return ONLY the expanded content.\n\n${text.slice(0, 2000)}`
    );
  },
};
