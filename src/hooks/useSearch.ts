import { useState, useCallback, useRef } from 'react';
import { SearchResult } from '../types';
import { SearchService } from '../services/SearchService';

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await SearchService.search(query);
        setResults(res);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  return { results, loading, search };
}
