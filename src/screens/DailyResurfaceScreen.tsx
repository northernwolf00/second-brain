import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SearchService } from '../services/SearchService';
import { Store } from '../store/mmkv';

const COLORS = { bg: '#0f0f0f', card: '#1a1a1a', accent: '#7c6af7', text: '#f0f0f0', muted: '#666', border: '#2a2a2a' };

export function DailyResurfaceScreen() {
  const navigation = useNavigation<any>();
  const [resurfaceNote, setResurfaceNote] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const cachedId = Store.getResurfaceNoteId();
    if (cachedId) {
      // Already picked for today — use cached
      setResurfaceNote({ id: cachedId, title: '' });
    }
    SearchService.getRandomOldNote(30).then(note => {
      if (note) {
        setResurfaceNote(note);
        Store.setResurfaceNoteId(note.id);
      }
    });
  }, []);

  if (!resurfaceNote) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.muted}>No old notes to resurface yet.</Text>
        <Text style={styles.hint}>Notes older than 30 days will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>From your past</Text>
        <Text style={styles.title}>{resurfaceNote.title || 'Loading…'}</Text>
        <Text style={styles.sub}>A note you haven't revisited in over 30 days.</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate('Editor', { noteId: resurfaceNote.id })}>
          <Text style={styles.btnText}>Open this note</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 40,
  },
  label: { color: COLORS.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sub: { color: COLORS.muted, fontSize: 14, marginBottom: 24 },
  btn: { backgroundColor: COLORS.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  muted: { color: COLORS.muted, fontSize: 16, marginBottom: 8 },
  hint: { color: '#444', fontSize: 13 },
});
