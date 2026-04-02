import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NoteService } from '../services/NoteService';
import { Note } from '../types';
import { Icon } from '../components/Icon';

const C = {
  bg: '#0f0f0f',
  card: '#1a1a1a',
  accent: '#7c6af7',
  accentDim: '#3d3580',
  text: '#f0f0f0',
  muted: '#666',
  border: '#2a2a2a',
  danger: '#f55',
};

const QUICK_TAGS = ['idea', 'todo', 'journal', 'research', 'book', 'meeting', 'quote'];

export function AddNoteScreen() {
  const navigation = useNavigation<any>();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<Note[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  const bodyRef = useRef<TextInput>(null);

  // ── wikilink autocomplete ─────────────────────────────────────
  const handleBodyChange = useCallback((text: string) => {
    setBody(text);
    const lastAt = text.lastIndexOf('[[');
    if (lastAt >= 0) {
      const query = text.slice(lastAt + 2);
      if (!query.includes(']]') && query.length >= 1) {
        NoteService.searchTitles(query).then(res => {
          setSuggestions(res);
          setShowSuggestions(res.length > 0);
        });
        return;
      }
    }
    setShowSuggestions(false);
  }, []);

  const insertWikilink = useCallback((targetTitle: string) => {
    const lastAt = body.lastIndexOf('[[');
    setBody(body.slice(0, lastAt) + `[[${targetTitle}]]`);
    setShowSuggestions(false);
  }, [body]);

  // ── tag management ────────────────────────────────────────────
  const addTag = useCallback((tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || tags.includes(clean)) return;
    setTags(prev => [...prev, clean]);
    setTagInput('');
  }, [tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  // ── save ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim() && !body.trim()) {
      Alert.alert('Empty note', 'Add a title or some content before saving.');
      return;
    }
    setSaving(true);
    try {
      const note = await NoteService.createNote(title.trim() || 'Untitled', body.trim());
      // TODO: persist tags once tag service is wired up
      navigation.replace('Editor', { noteId: note.id });
    } catch (e) {
      console.error('[AddNoteScreen] save failed', e);
      Alert.alert('Save failed', String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }, [title, body, navigation]);

  const handleDiscard = useCallback(() => {
    if (title || body) {
      Alert.alert('Discard note?', 'Your unsaved content will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  }, [title, body, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="close" size={24} color={C.muted} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New note</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, saving && styles.saveBtnDim]}
          disabled={saving}>
          <Icon name="check" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.scrollContent}>

        {/* ── Title ── */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={C.muted}
          returnKeyType="next"
          onSubmitEditing={() => bodyRef.current?.focus()}
          blurOnSubmit={false}
          autoFocus
        />

        {/* ── Toolbar ── */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setBody(b => b + '[[')}>
            <Icon name="link" size={18} color={C.accent} />
            <Text style={styles.toolLabel}>Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setBody(b => b + '**bold**')}>
            <Icon name="format-bold" size={18} color={C.accent} />
            <Text style={styles.toolLabel}>Bold</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setBody(b => b + '\n- ')}>
            <Icon name="format-list-bulleted" size={18} color={C.accent} />
            <Text style={styles.toolLabel}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setBody(b => b + '\n## ')}>
            <Icon name="title" size={18} color={C.accent} />
            <Text style={styles.toolLabel}>Heading</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setBody(b => b + '\n> ')}>
            <Icon name="format-quote" size={18} color={C.accent} />
            <Text style={styles.toolLabel}>Quote</Text>
          </TouchableOpacity>
        </View>

        {/* ── Body ── */}
        <TextInput
          ref={bodyRef}
          style={styles.bodyInput}
          value={body}
          onChangeText={handleBodyChange}
          placeholder={"Start writing…\n\nTip: type [[ to link to another note"}
          placeholderTextColor={C.muted}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />

        {/* ── Wikilink autocomplete ── */}
        {showSuggestions && (
          <View style={styles.suggestBox}>
            <FlatList
              data={suggestions}
              keyExtractor={n => n.id}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestItem}
                  onPress={() => insertWikilink(item.title)}>
                  <Icon name="insert-link" size={16} color={C.accent} />
                  <Text style={styles.suggestText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Tags ── */}
        <View style={styles.tagsSection}>
          <View style={styles.tagsRow}>
            <Icon name="label-outline" size={16} color={C.muted} />
            <Text style={styles.tagsLabel}>Tags</Text>
          </View>

          <View style={styles.tagChips}>
            {tags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => removeTag(tag)}>
                <Text style={styles.tagChipText}>#{tag}</Text>
                <Icon name="close" size={12} color={C.accent} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick tag suggestions */}
          <View style={styles.quickTags}>
            {QUICK_TAGS.filter(t => !tags.includes(t)).map(tag => (
              <TouchableOpacity
                key={tag}
                style={styles.quickTag}
                onPress={() => addTag(tag)}>
                <Text style={styles.quickTagText}>+{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom tag input */}
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add custom tag…"
              placeholderTextColor={C.muted}
              returnKeyType="done"
              onSubmitEditing={() => addTag(tagInput)}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.tagAddBtn, !tagInput.trim() && styles.tagAddBtnDim]}
              onPress={() => addTag(tagInput)}
              disabled={!tagInput.trim()}>
              <Icon name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, color: C.text, fontSize: 16, fontWeight: '600', marginLeft: 12 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnDim: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  // Title
  titleInput: {
    color: C.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 10,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  toolBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderRadius: 8,
    gap: 2,
  },
  toolLabel: { color: C.muted, fontSize: 9 },

  // Body
  bodyInput: {
    color: C.text,
    fontSize: 15,
    lineHeight: 26,
    minHeight: 220,
  },

  // Wikilink suggestions
  suggestBox: {
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    maxHeight: 160,
    marginTop: 4,
    marginBottom: 8,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  suggestText: { color: C.text, fontSize: 14 },

  // Tags
  tagsSection: {
    marginTop: 24,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  tagsLabel: { color: C.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagChipText: { color: C.accent, fontSize: 12, fontWeight: '600' },
  quickTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  quickTag: {
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  quickTagText: { color: C.muted, fontSize: 12 },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  tagInput: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  tagAddBtn: {
    backgroundColor: C.accent,
    borderRadius: 8,
    padding: 10,
  },
  tagAddBtnDim: { opacity: 0.4 },
});
