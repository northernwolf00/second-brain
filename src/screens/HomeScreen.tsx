import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotes } from '../hooks/useNotes';
import { Note } from '../types';

const COLORS = { bg: '#0f0f0f', card: '#1a1a1a', accent: '#7c6af7', text: '#f0f0f0', muted: '#666' };

function NoteCard({ note, onPress, onLongPress }: { note: Note; onPress: () => void; onLongPress: () => void }) {
  const date = new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
      <Text style={styles.cardTitle} numberOfLines={1}>{note.title || 'Untitled'}</Text>
      {!!note.body_preview && (
        <Text style={styles.cardPreview} numberOfLines={2}>{note.body_preview}</Text>
      )}
      <Text style={styles.cardDate}>{date}</Text>
    </TouchableOpacity>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { notes, loading, refresh, deleteNote } = useNotes();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Editor', { noteId: null })}
          style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Delete note', `Delete "${title || 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNote(id) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        onRefresh={refresh}
        refreshing={loading}
        contentContainerStyle={notes.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.muted}>Tap + to create your first note</Text>
          </View>
        }
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            onPress={() => navigation.navigate('Editor', { noteId: item.id })}
            onLongPress={() => confirmDelete(item.id, item.title)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardPreview: { color: COLORS.muted, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  cardDate: { color: '#444', fontSize: 11 },
  headerBtn: { marginRight: 16, padding: 4 },
  headerBtnText: { color: COLORS.accent, fontSize: 28, fontWeight: '300', lineHeight: 28 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  muted: { color: COLORS.muted, fontSize: 14 },
});
