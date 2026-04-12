import React, { useLayoutEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useAlert } from '../theme/AlertContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useNotes } from '../hooks/useNotes';
import { Note } from '../types';
import { Icon } from '../components/Icon';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../theme';

function NoteCard({ note, onPress, onLongPress }: { note: Note; onPress: () => void; onLongPress: () => void }) {
  const { colors } = useTheme();
  const date = new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}>
      <View style={[styles.cardAccent, { backgroundColor: colors.accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {note.title || 'Untitled'}
          </Text>
          <Text style={[styles.cardDate, { color: colors.muted }]}>{date}</Text>
        </View>
        {!!note.body_preview && (
          <Text style={[styles.cardPreview, { color: colors.textSecondary }]} numberOfLines={2}>
            {note.body_preview.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const { notes, loading, refresh, deleteNote } = useNotes();
  const { colors } = useTheme();
  const { showAlert } = useAlert();

  // Refresh list every time this screen comes into focus (after AddNote / Editor)
  useFocusEffect(
    useCallback(() => { refresh(); }, [refresh]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddNote')}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="add" size={26} color={colors.accent} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const confirmDelete = (id: string, title: string) => {
    showAlert({
      title: 'Delete note',
      message: `Delete "${title || 'Untitled'}"?`,
      icon: 'delete-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteNote(id) },
      ],
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        onRefresh={refresh}
        refreshing={loading}
        contentContainerStyle={notes.length === 0 ? styles.emptyContainer : styles.list}
        ListHeaderComponent={
          notes.length > 0 ? (
            <Text style={[styles.listHeader, { color: colors.muted }]}>
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentSoft }]}>
              <Icon name="note-add" size={36} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notes yet</Text>
            <Text style={[styles.emptyHint, { color: colors.muted }]}>
              Tap the button to create your first note
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
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

      {/* New note FAB */}
      {notes.length > 0 && (
        <Animated.View entering={FadeInRight.delay(200).springify()}>
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('AddNote')}
            activeOpacity={0.85}>
            <Icon name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* AI Assistant FAB */}
      <Animated.View entering={FadeInRight.delay(400).springify()}>
        <TouchableOpacity
          style={[styles.aiFab, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate('AIAssistant', {})}
          activeOpacity={0.85}>
          <Icon name="auto-awesome" size={22} color={colors.accent} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 96 },
  emptyContainer: { flex: 1 },
  listHeader: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, marginTop: 4,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardAccent: { width: 3, borderRadius: 2 },
  cardBody: { flex: 1, padding: 14 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  cardTitle: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  cardDate: { fontSize: 11, fontWeight: '500' },
  cardPreview: { fontSize: 13, lineHeight: 19 },
  headerBtn: { marginRight: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  aiFab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
});
