import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NoteService } from '../services/NoteService';
import { AIService } from '../services/AIService';
import { Note } from '../types';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme';

const QUICK_TAGS = ['idea', 'todo', 'journal', 'research', 'book', 'meeting', 'quote'];

export function AddNoteScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<Note[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);

  const bodyRef = useRef<TextInput>(null);

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

  const addTag = useCallback((tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || tags.includes(clean)) return;
    setTags(prev => [...prev, clean]);
    setTagInput('');
  }, [tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim() && !body.trim()) {
      Alert.alert('Empty note', 'Add a title or some content before saving.');
      return;
    }
    setSaving(true);
    try {
      const note = await NoteService.createNote(title.trim() || 'Untitled', body.trim());
      navigation.replace('Editor', { noteId: note.id });
    } catch (e) {
      Alert.alert('Save failed', String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }, [title, body, navigation]);

  const handleAIImprove = useCallback(async () => {
    if (!body.trim()) return;
    setAiWorking(true);
    const improved = await AIService.improveText(body);
    if (improved) setBody(improved);
    setAiWorking(false);
  }, [body]);

  const handleAIExpand = useCallback(async () => {
    if (!body.trim()) return;
    setAiWorking(true);
    const expanded = await AIService.expandIdea(body);
    if (expanded) setBody(expanded);
    setAiWorking(false);
  }, [body]);

  const handleAIChat = useCallback(() => {
    navigation.navigate('AIAssistant', {
      text: body,
      prompt: body.trim()
        ? `I'm writing a note titled "${title || 'Untitled'}". Here's what I have so far:\n\n${body}\n\nHelp me continue or improve it.`
        : '',
    });
  }, [navigation, title, body]);

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
      style={[styles.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleDiscard} style={styles.headerIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="close" size={22} color={colors.muted} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New note</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: colors.accent }, saving && styles.dim]}
          disabled={saving}>
          <Icon name="check" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardDismissMode="interactive" contentContainerStyle={styles.scrollContent}>

        {/* Title */}
        <TextInput
          style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          onSubmitEditing={() => bodyRef.current?.focus()}
          blurOnSubmit={false}
          autoFocus
        />

        {/* Formatting toolbar */}
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          {[
            { icon: 'link', label: 'Link', action: () => setBody(b => b + '[[') },
            { icon: 'format-bold', label: 'Bold', action: () => setBody(b => b + '**bold**') },
            { icon: 'format-list-bulleted', label: 'List', action: () => setBody(b => b + '\n- ') },
            { icon: 'title', label: 'H2', action: () => setBody(b => b + '\n## ') },
            { icon: 'format-quote', label: 'Quote', action: () => setBody(b => b + '\n> ') },
          ].map(({ icon, label, action }) => (
            <TouchableOpacity
              key={label}
              style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={action}>
              <Icon name={icon} size={17} color={colors.accent} />
              <Text style={[styles.toolLabel, { color: colors.muted }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body */}
        <TextInput
          ref={bodyRef}
          style={[styles.bodyInput, { color: colors.text }]}
          value={body}
          onChangeText={handleBodyChange}
          placeholder={'Start writing…\n\nTip: type [[ to link to another note'}
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />

        {/* AI toolbar — shown when there's content */}
        {body.length > 20 && (
          <View style={[styles.aiBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {aiWorking ? (
              <View style={styles.aiBarLoading}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={[styles.aiBarLoadingText, { color: colors.accent }]}>AI working…</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.aiBarBtn, { borderColor: colors.border }]}
                  onPress={handleAIImprove}>
                  <Icon name="auto-fix-high" size={15} color={colors.accent} />
                  <Text style={[styles.aiBarBtnText, { color: colors.accent }]}>Improve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBarBtn, { borderColor: colors.border }]}
                  onPress={handleAIExpand}>
                  <Icon name="expand" size={15} color={colors.accent} />
                  <Text style={[styles.aiBarBtnText, { color: colors.accent }]}>Expand</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBarBtn, styles.aiBarBtnAccent, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}
                  onPress={handleAIChat}>
                  <Icon name="chat" size={15} color={colors.accent} />
                  <Text style={[styles.aiBarBtnText, { color: colors.accent }]}>Ask AI</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Wikilink autocomplete */}
        {showSuggestions && (
          <View style={[styles.suggestBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FlatList
              data={suggestions}
              keyExtractor={n => n.id}
              keyboardShouldPersistTaps="always"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.suggestItem, { borderBottomColor: colors.border }]}
                  onPress={() => insertWikilink(item.title)}>
                  <Icon name="insert-link" size={16} color={colors.accent} />
                  <Text style={[styles.suggestText, { color: colors.text }]}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Tags */}
        <View style={[styles.tagsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.tagsHeader}>
            <Icon name="label-outline" size={15} color={colors.muted} />
            <Text style={[styles.tagsLabel, { color: colors.muted }]}>Tags</Text>
          </View>

          {tags.length > 0 && (
            <View style={styles.tagChips}>
              {tags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: colors.accentSoft }]}
                  onPress={() => removeTag(tag)}>
                  <Text style={[styles.tagChipText, { color: colors.accent }]}>#{tag}</Text>
                  <Icon name="close" size={11} color={colors.accent} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Quick tags */}
          <View style={styles.quickTags}>
            {QUICK_TAGS.filter(t => !tags.includes(t)).map(tag => (
              <TouchableOpacity
                key={tag}
                style={[styles.quickTag, { borderColor: colors.border }]}
                onPress={() => addTag(tag)}>
                <Text style={[styles.quickTagText, { color: colors.textSecondary }]}>+{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom tag input */}
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.tagInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add custom tag…"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              onSubmitEditing={() => addTag(tagInput)}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.tagAddBtn, { backgroundColor: colors.accent }, !tagInput.trim() && styles.dim]}
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
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1,
  },
  headerIconBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', marginLeft: 12 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dim: { opacity: 0.5 },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 60 },
  titleInput: {
    fontSize: 24, fontWeight: '700', marginBottom: 10,
    borderBottomWidth: 1, paddingBottom: 12,
  },
  toolbar: {
    flexDirection: 'row', gap: 6, marginBottom: 16,
    paddingBottom: 12, borderBottomWidth: 1,
  },
  toolBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, gap: 3,
  },
  toolLabel: { fontSize: 9, fontWeight: '600' },
  bodyInput: { fontSize: 15, lineHeight: 26, minHeight: 220 },
  suggestBox: { borderRadius: 12, borderWidth: 1, maxHeight: 160, marginTop: 4, marginBottom: 8 },
  suggestItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderBottomWidth: 1,
  },
  suggestText: { fontSize: 14 },
  tagsSection: {
    marginTop: 24, borderRadius: 14, padding: 14, borderWidth: 1,
  },
  tagsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  tagsLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  tagChipText: { fontSize: 12, fontWeight: '600' },
  quickTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  quickTag: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  quickTagText: { fontSize: 12 },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagInput: { flex: 1, fontSize: 13, borderRadius: 10, padding: 10, borderWidth: 1 },
  tagAddBtn: { borderRadius: 10, padding: 10 },

  // AI toolbar
  aiBar: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
    padding: 10, borderRadius: 14, borderWidth: 1,
  },
  aiBarLoading: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  aiBarLoadingText: { fontSize: 13, fontWeight: '600' },
  aiBarBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  aiBarBtnAccent: {},
  aiBarBtnText: { fontSize: 12, fontWeight: '700' },
});
