import { useState, useEffect, useCallback } from 'react';
import { Note } from '../types';
import { NoteService } from '../services/NoteService';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const all = await NoteService.getAllNotes();
      setNotes(all);
    } catch (e) {
      console.error('[useNotes]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createNote = useCallback(async (title: string, body: string): Promise<Note> => {
    const note = await NoteService.createNote(title, body);
    await refresh();
    return note;
  }, [refresh]);

  const deleteNote = useCallback(async (id: string) => {
    await NoteService.deleteNote(id);
    await refresh();
  }, [refresh]);

  return { notes, loading, refresh, createNote, deleteNote };
}
