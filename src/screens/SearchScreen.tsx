import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSearch } from '../hooks/useSearch';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

function highlight(text: string, colors: ReturnType<typeof useTheme>['colors']): React.ReactNode {
  const parts = text.split(/(\[.*?\])/g);
  return parts.map((part, i) =>
    part.startsWith('[') && part.endsWith(']')
      ? <Text key={i} style={{ color: colors.accent, fontWeight: '600' }}>{part.slice(1, -1)}</Text>
      : <Text key={i}>{part}</Text>,
  );
}

export function SearchScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const { results, loading, search } = useSearch();
  const { colors } = useTheme();

  const handleChange = (text: string) => {
    setQuery(text);
    search(text);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={handleChange}
            placeholder="Search notes…"
            placeholderTextColor={colors.muted}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {loading && <ActivityIndicator color={colors.accent} size="small" />}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={r => r.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={
          results.length === 0 ? styles.emptyContainer : { padding: 16, paddingBottom: 32 }
        }
        ListEmptyComponent={
          <View style={styles.center}>
            {query ? (
              <>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="search-off" size={32} color={colors.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No results</Text>
                <Text style={[styles.emptyHint, { color: colors.muted }]}>Try a different search term</Text>
              </>
            ) : (
              <>
                <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentSoft }]}>
                  <Icon name="search" size={32} color={colors.accent} />
                </View>
                <Text style={[styles.emptyHint, { color: colors.muted }]}>Type to search all notes</Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.result, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Editor', { noteId: item.id })}
            activeOpacity={0.75}>
            <View style={[styles.resultAccent, { backgroundColor: colors.accent }]} />
            <View style={styles.resultBody}>
              <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title || 'Untitled'}
              </Text>
              <Text style={[styles.resultExcerpt, { color: colors.textSecondary }]} numberOfLines={2}>
                {highlight(item.excerpt || item.body_preview, colors)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: { padding: 12, borderBottomWidth: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  result: {
    flexDirection: 'row', borderRadius: 14, marginBottom: 10, borderWidth: 1, overflow: 'hidden',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  resultAccent: { width: 3 },
  resultBody: { flex: 1, padding: 14 },
  resultTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  resultExcerpt: { fontSize: 13, lineHeight: 19 },
  emptyContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyHint: { fontSize: 14 },
});
