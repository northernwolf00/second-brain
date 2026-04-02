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
import { AIService } from '../services/AIService';
import { Note } from '../types';
import { Store } from '../store/mmkv';

const COLORS = { bg: '#0f0f0f', card: '#1a1a1a', accent: '#7c6af7', text: '#f0f0f0', muted: '#666', border: '#2a2a2a' };

export function EditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { noteId } = route.params as { noteId: string | null };

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [suggestions, setSuggestions] = useState<Note[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [backlinks, setBacklinks] = useState<Note[]>([]);

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
        saving ? <ActivityIndicator color={COLORS.accent} style={{ marginRight: 16 }} /> : null,
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

  const generateAISummary = useCallback(async () => {
    const summary = await AIService.summarizeNote(body);
    setAiSummary(summary);
  }, [body]);

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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}>
      <ScrollView style={styles.scroll} keyboardDismissMode="interactive">
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={handleTitleChange}
          placeholder="Title"
          placeholderTextColor={COLORS.muted}
          multiline={false}
          returnKeyType="next"
        />

        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={handleBodyChange}
          placeholder="Start writing… use [[note title]] to link notes"
          placeholderTextColor={COLORS.muted}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />

        {/* Wikilink autocomplete */}
        {showSuggestions && (
          <View style={styles.suggestionBox}>
            <FlatList
              data={suggestions}
              keyExtractor={n => n.id}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => insertWikilink(item.title)}>
                  <Text style={styles.suggestionText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* AI Summary */}
        {body.length > 100 && (
          <View style={styles.aiSection}>
            <TouchableOpacity style={styles.aiBtn} onPress={generateAISummary}>
              <Text style={styles.aiBtnText}>Generate AI summary</Text>
            </TouchableOpacity>
            {!!aiSummary && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Summary</Text>
                <Text style={styles.summaryText}>{aiSummary}</Text>
              </View>
            )}
          </View>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <View style={styles.backlinksSection}>
            <Text style={styles.sectionLabel}>Linked from</Text>
            {backlinks.map(bl => (
              <TouchableOpacity
                key={bl.id}
                style={styles.backlinkItem}
                onPress={() => navigation.push('Editor', { noteId: bl.id })}>
                <Text style={styles.backlinkText}>{bl.title || 'Untitled'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1, padding: 16 },
  titleInput: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bodyInput: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 300,
    paddingBottom: 40,
  },
  suggestionBox: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 180,
    marginBottom: 8,
  },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionText: { color: COLORS.text, fontSize: 14 },
  aiSection: { marginTop: 16 },
  aiBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  aiBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  summaryBox: {
    marginTop: 10,
    backgroundColor: '#1e1a3a',
    borderRadius: 8,
    padding: 12,
  },
  summaryLabel: { color: COLORS.accent, fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  summaryText: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  backlinksSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 16 },
  sectionLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  backlinkItem: { paddingVertical: 8 },
  backlinkText: { color: COLORS.accent, fontSize: 14 },
});
