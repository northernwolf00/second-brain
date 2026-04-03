import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NoteService } from '../services/NoteService';
import { Note } from '../types';
import { Store } from '../store/mmkv';
import { useAI } from '../hooks/useAI';
import { useTheme } from '../theme';

export function EditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { noteId } = route.params as { noteId: string | null };
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Note[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const { summary: aiSummary, tags: aiTags, loading: aiLoading, analyzeNote } = useAI();

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteId = useRef<string | null>(noteId);

  // Load existing note
  useEffect(() => {
    if (noteId) {
      NoteService.getNoteById(noteId).then(n => {
        if (n) {
          setNote(n);
          setTitle(n.title);
          setBody(n.body);
          Store.setLastOpenedNoteId(n.id);
        }
      });
      NoteService.getBacklinks(noteId).then(setBacklinks);
    }
  }, [noteId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title || 'New note',
      headerRight: () =>
        saving ? <ActivityIndicator color={colors.accent} style={{ marginRight: 16 }} /> : null,
    });
  }, [navigation, title, saving]);

  const save = useCallback(async (t: string, b: string) => {
    setSaving(true);
    try {
      if (currentNoteId.current) {
        await NoteService.updateNote(currentNoteId.current, { title: t, body: b });
      } else {
        const created = await NoteService.createNote(t || 'Untitled', b);
        currentNoteId.current = created.id;
        Store.setLastOpenedNoteId(created.id);
      }
    } catch (e) {
      console.error('[EditorScreen] save failed', e);
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleAutoSave = useCallback((t: string, b: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(t, b), 2000);
  }, [save]);

  const handleBodyChange = useCallback((text: string) => {
    setBody(text);
    scheduleAutoSave(title, text);

    // Detect [[ for wikilink autocomplete
    const lastAt = text.lastIndexOf('[[');
    if (lastAt >= 0) {
      const query = text.slice(lastAt + 2);
      if (!query.includes(']]') && query.length >= 1) {
        NoteService.searchTitles(query).then(results => {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        });
        return;
      }
    }
    setShowSuggestions(false);
  }, [title, scheduleAutoSave]);

  const handleTitleChange = useCallback((text: string) => {
    setTitle(text);
    scheduleAutoSave(text, body);
  }, [body, scheduleAutoSave]);

  const insertWikilink = useCallback((targetTitle: string) => {
    const lastAt = body.lastIndexOf('[[');
    const newBody = body.slice(0, lastAt) + `[[${targetTitle}]]`;
    setBody(newBody);
    setShowSuggestions(false);
    scheduleAutoSave(title, newBody);
  }, [body, title, scheduleAutoSave]);

  const handleAIAnalyze = useCallback(() => {
    analyzeNote(title, body);
  }, [title, body, analyzeNote]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (title || body) save(title, body);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <ScrollView style={styles.scroll} keyboardDismissMode="interactive">
        <TextInput
          style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
          value={title}
          onChangeText={handleTitleChange}
          placeholder="Title"
          placeholderTextColor={colors.muted}
          multiline={false}
          returnKeyType="next"
        />

        <TextInput
          style={[styles.bodyInput, { color: colors.text }]}
          value={body}
          onChangeText={handleBodyChange}
          placeholder="Start writing… use [[note title]] to link notes"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />

        {/* Wikilink autocomplete */}
        {showSuggestions && (
          <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FlatList
              data={suggestions}
              keyExtractor={n => n.id}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                  onPress={() => insertWikilink(item.title)}>
                  <Text style={[styles.suggestionText, { color: colors.text }]}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* AI Panel */}
        {body.length > 100 && (
          <View style={styles.aiSection}>
            <TouchableOpacity
              style={[styles.aiBtn, { backgroundColor: colors.card, borderColor: colors.accent }]}
              onPress={handleAIAnalyze}
              disabled={aiLoading}>
              <Text style={[styles.aiBtnText, { color: colors.accent }]}>
                {aiLoading ? 'Analyzing…' : '✦ Analyze with Gemini'}
              </Text>
            </TouchableOpacity>
            {!!aiSummary && (
              <View style={[styles.summaryBox, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}>
                <Text style={[styles.summaryLabel, { color: colors.accent }]}>Summary</Text>
                <Text style={[styles.summaryText, { color: colors.text }]}>{aiSummary}</Text>
              </View>
            )}
            {aiTags.length > 0 && (
              <View style={styles.tagsRow}>
                {aiTags.map(tag => (
                  <View key={tag} style={[styles.tagPill, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}>
                    <Text style={[styles.tagText, { color: colors.accent }]}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <View style={[styles.backlinksSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Linked from</Text>
            {backlinks.map(bl => (
              <TouchableOpacity
                key={bl.id}
                style={styles.backlinkItem}
                onPress={() => navigation.push('Editor', { noteId: bl.id })}>
                <Text style={[styles.backlinkText, { color: colors.accent }]}>{bl.title || 'Untitled'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, padding: 18 },
  titleInput: {
    fontSize: 24, fontWeight: '700', marginBottom: 14,
    paddingVertical: 4, borderBottomWidth: 1,
  },
  bodyInput: { fontSize: 15, lineHeight: 26, minHeight: 300, paddingBottom: 40 },
  suggestionBox: { borderRadius: 12, borderWidth: 1, maxHeight: 180, marginBottom: 8 },
  suggestionItem: { padding: 12, borderBottomWidth: 1 },
  suggestionText: { fontSize: 14 },
  aiSection: { marginTop: 20 },
  aiBtn: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  aiBtnText: { fontSize: 13, fontWeight: '700' },
  summaryBox: { marginTop: 12, borderRadius: 12, padding: 14, borderWidth: 1 },
  summaryLabel: { fontSize: 10, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryText: { fontSize: 14, lineHeight: 21 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  tagPill: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: '600' },
  backlinksSection: { marginTop: 28, borderTopWidth: 1, paddingTop: 18 },
  sectionLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  backlinkItem: { paddingVertical: 8 },
  backlinkText: { fontSize: 14, fontWeight: '500' },
});
