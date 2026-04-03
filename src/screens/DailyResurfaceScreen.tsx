import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SearchService } from '../services/SearchService';
import { Store } from '../store/mmkv';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

export function DailyResurfaceScreen() {
  const navigation = useNavigation<any>();
  const [resurfaceNote, setResurfaceNote] = useState<{ id: string; title: string } | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    Store.getResurfaceNoteId().then(cachedId => {
      if (cachedId) {
        setResurfaceNote({ id: cachedId, title: '' });
      }
      SearchService.getRandomOldNote(30).then(note => {
        if (note) {
          setResurfaceNote(note);
          Store.setResurfaceNoteId(note.id);
        }
      });
    });
  }, []);

  if (!resurfaceNote) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.bg }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentSoft }]}>
          <Icon name="auto-awesome" size={36} color={colors.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing to resurface</Text>
        <Text style={[styles.emptyHint, { color: colors.muted }]}>
          Notes older than 30 days will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.inner}>
        <View style={[styles.badgeRow]}>
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <Icon name="auto-awesome" size={13} color={colors.accent} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>From your past</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {resurfaceNote.title || 'Loading…'}
          </Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
            A note you haven't revisited in over 30 days.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('Editor', { noteId: resurfaceNote.id })}
            activeOpacity={0.85}>
            <Icon name="open-in-new" size={18} color="#fff" />
            <Text style={styles.btnText}>Open this note</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footerHint, { color: colors.muted }]}>
          Refreshes daily · Write more notes to unlock this feature
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  badgeRow: { flexDirection: 'row', marginBottom: 16 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    borderRadius: 20, padding: 24, borderWidth: 1,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  cardTitle: { fontSize: 24, fontWeight: '700', marginBottom: 10, lineHeight: 32 },
  cardSub: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, padding: 15, justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footerHint: { textAlign: 'center', fontSize: 12, marginTop: 20 },
});
