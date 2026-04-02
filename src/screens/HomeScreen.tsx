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
import { Icon } from '../components/Icon';

const C = {
  bg: '#0f0f0f',
  card: '#1a1a1a',
  accent: '#7c6af7',
  text: '#f0f0f0',
  muted: '#666',
  border: '#2a2a2a',
};

function NoteCard({
  note,
  onPress,
  onLongPress,
}: {
  note: Note;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const date = new Date(note.updated_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {note.title || 'Untitled'}
        </Text>
        <Text style={styles.cardDate}>{date}</Text>
      </View>
      {!!note.body_preview && (
        <Text style={styles.cardPreview} numberOfLines={2}>
          {note.body_preview}
        </Text>
      )}
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
          onPress={() => navigation.navigate('AddNote')}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="add" size={28} color={C.accent} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Delete note', `Delete "${title || 'Untitled'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNote(id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        onRefresh={refresh}
        refreshing={loading}
        contentContainerStyle={
          notes.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Icon name="note-add" size={56} color="#2a2a2a" />
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyHint}>Tap + to create your first note</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('AddNote')}>
              <Icon name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>New note</Text>
            </TouchableOpacity>
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

      {/* Floating action button */}
      {notes.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddNote')}
          activeOpacity={0.85}>
          <Icon name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { padding: 12, paddingBottom: 88 },
  emptyContainer: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  cardDate: { color: '#444', fontSize: 11 },
  cardPreview: { color: C.muted, fontSize: 13, lineHeight: 18 },
  headerBtn: { marginRight: 14 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '600' },
  emptyHint: { color: C.muted, fontSize: 14 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#7c6af7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
