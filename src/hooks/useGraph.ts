import { useState, useEffect } from 'react';
import { GraphData, GraphEngine } from '../services/GraphEngine';

export function useGraph() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GraphEngine.buildGraph()
      .then(setGraph)
      .catch(e => console.error('[useGraph]', e))
      .finally(() => setLoading(false));
  }, []);

  return { graph, loading };
}
