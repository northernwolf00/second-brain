/**
 * AIService — on-device AI using llama.rn (Phi-3 Mini GGUF).
 *
 * Setup: Install llama.rn (`npm install llama.rn`) and download the
 * Phi-3 Mini 4-bit GGUF model (~1.8 GB) to the app's document directory.
 * Model download URL (via Hugging Face):
 *   https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf
 *
 * The service degrades gracefully when the model is not loaded.
 */

// Uncomment after running: npm install llama.rn
// import { initLlama, LlamaContext } from 'llama.rn';
// import RNFS from 'react-native-fs';

type LlamaContext = { completion: (opts: Record<string, unknown>) => Promise<{ text: string }> };

let _ctx: LlamaContext | null = null;

async function getCtx(): Promise<LlamaContext | null> {
  if (_ctx) return _ctx;
  // Uncomment to enable:
  // const modelPath = `${RNFS.DocumentDirectoryPath}/phi3-mini-q4.gguf`;
  // const exists = await RNFS.exists(modelPath);
  // if (!exists) return null;
  // _ctx = await initLlama({ model: modelPath, n_ctx: 2048, n_gpu_layers: 1 });
  return null;
}

async function complete(prompt: string): Promise<string> {
  const ctx = await getCtx();
  if (!ctx) return '';
  const result = await ctx.completion({ prompt, n_predict: 256, temperature: 0.3 });
  return result.text.trim();
}

export const AIService = {
  isAvailable(): boolean {
    return _ctx !== null;
  },

  async summarizeNote(body: string): Promise<string> {
    if (!body.trim()) return '';
    const ctx = await getCtx();
    if (!ctx) return body.slice(0, 150) + (body.length > 150 ? '…' : '');
    return complete(
      `<|user|>Summarize this note in exactly 2 sentences. Return only the summary.\n\n${body.slice(0, 2000)}<|end|>\n<|assistant|>`,
    );
  },

  async suggestTags(body: string): Promise<string[]> {
    if (!body.trim()) return [];
    const ctx = await getCtx();
    if (!ctx) return [];
    const raw = await complete(
      `<|user|>Suggest 3-5 short tags for this note. Return only a JSON array of strings, e.g. ["tag1","tag2"].\n\n${body.slice(0, 1500)}<|end|>\n<|assistant|>`,
    );
    try {
      const parsed = JSON.parse(raw.match(/\[.*\]/s)?.[0] ?? '[]');
      return Array.isArray(parsed) ? parsed.map(String).slice(0, 5) : [];
    } catch {
      return [];
    }
  },

  async semanticSearch(query: string, notes: { id: string; body: string }[]): Promise<string[]> {
    if (!notes.length) return [];
    const ctx = await getCtx();
    if (!ctx) return notes.map(n => n.id);

    const snippets = notes
      .map((n, i) => `[${i}] ${n.body.slice(0, 300)}`)
      .join('\n---\n');

    const raw = await complete(
      `<|user|>Given this query: "${query}"\nRank these notes by relevance (most relevant first). Return only a JSON array of indices, e.g. [2,0,1].\n\n${snippets}<|end|>\n<|assistant|>`,
    );

    try {
      const indices = JSON.parse(raw.match(/\[.*\]/s)?.[0] ?? '[]') as number[];
      return indices.map(i => notes[i]?.id).filter(Boolean);
    } catch {
      return notes.map(n => n.id);
    }
  },
};
