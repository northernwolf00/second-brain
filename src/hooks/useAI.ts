import { useState, useCallback } from 'react';
import { AIService } from '../services/AIService';

export function useAI() {
  const [summary, setSummary] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const analyzeNote = useCallback(async (title: string, body: string) => {
    const available = await AIService.isAvailable();
    if (!available) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        AIService.summarizeNote(title, body),
        AIService.suggestTags(title, body),
      ]);
      setSummary(s);
      setTags(t);
    } finally {
      setLoading(false);
    }
  }, []);

  return { summary, tags, loading, analyzeNote };
}
