import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSearch } from '../hooks/useSearch';

const COLORS = { bg: '#0f0f0f', card: '#1a1a1a', accent: '#7c6af7', text: '#f0f0f0', muted: '#666', border: '#2a2a2a' };

function highlight(text: string): React.ReactNode {
  const parts = text.split(/(\[.*?\])/g);
  return parts.map((part, i) =>
    part.startsWith('[') && part.endsWith(']')
      ? <Text key={i} style={styles.highlight}>{part.slice(1, -1)}</Text>
      : <Text key={i}>{part}</Text>,
  );
}

export function SearchScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const { results, loading, search } = useSearch();

  const handleChange = (text: string) => {
    setQuery(text);
    search(text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleChange}
          placeholder="Search notes…"
          placeholderTextColor={COLORS.muted}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {loading && <ActivityIndicator color={COLORS.accent} size="small" style={{ marginRight: 8 }} />}
      </View>

      <FlatList
        data={results}
        keyExtractor={r => r.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={results.length === 0 && query ? styles.emptyContainer : { padding: 12 }}
        ListEmptyComponent={
          query ? (
            <View style={styles.center}>
              <Text style={styles.muted}>No results for "{query}"</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.muted}>Type to search all notes</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.result}
            onPress={() => navigation.navigate('Editor', { noteId: item.id })}
            activeOpacity={0.7}>
            <Text style={styles.resultTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <Text style={styles.resultExcerpt} numberOfLines={3}>
              {highlight(item.excerpt || item.body_preview)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  searchIcon: { color: COLORS.muted, fontSize: 20, marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 12 },
  result: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  resultExcerpt: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  highlight: { color: COLORS.accent, fontWeight: '600' },
  emptyContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  muted: { color: COLORS.muted, fontSize: 14 },
});
