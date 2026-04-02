export interface Note {
  id: string;
  title: string;
  body: string;
  body_preview: string;
  created_at: number;
  updated_at: number;
  is_deleted: 0 | 1;
  embedding_id?: string;
}

export interface Link {
  id: string;
  source_id: string;
  target_id: string;
  alias?: string;
  created_at: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  note_count: number;
}

export interface NoteTag {
  note_id: string;
  tag_id: string;
}

export interface SearchResult {
  id: string;
  title: string;
  body_preview: string;
  excerpt: string;
  updated_at: number;
}

export interface GraphNode {
  id: string;
  title: string;
  x?: number;
  y?: number;
  linkCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface SyncLogEntry {
  id: string;
  note_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  synced_at?: number;
  checksum?: string;
}
