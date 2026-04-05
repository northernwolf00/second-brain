import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, FlatList,
  Alert, ActivityIndicator, NativeSyntheticEvent, TextInputSelectionChangeEventData,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NoteService } from '../services/NoteService';
import { AIService } from '../services/AIService';
import { Note } from '../types';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme';

const QUICK_TAGS = ['idea', 'todo', 'journal', 'research', 'book', 'meeting', 'quote'];

type Selection = { start: number; end: number };

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

  // Track cursor / selection in body editor
  const selectionRef = useRef<Selection>({ start: 0, end: 0 });
  const bodyRef = useRef<TextInput>(null);

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      selectionRef.current = e.nativeEvent.selection;
    },
    [],
  );

  // ── Formatting helpers ──────────────────────────────────────────────────────

  const applyFormat = useCallback(
    (type: 'bold' | 'italic' | 'link' | 'list' | 'heading' | 'quote' | 'code') => {
      const { start, end } = selectionRef.current;
      const selected = body.slice(start, end);

      let newBody = body;

      switch (type) {
        case 'bold':
          if (selected) {
            newBody = body.slice(0, start) + `**${selected}**` + body.slice(end);
          } else {
            newBody = body.slice(0, start) + '**bold**' + body.slice(end);
          }
          break;

        case 'italic':
          if (selected) {
            newBody = body.slice(0, start) + `_${selected}_` + body.slice(end);
          } else {
            newBody = body.slice(0, start) + '_italic_' + body.slice(end);
          }
          break;

        case 'link':
          if (selected) {
            newBody = body.slice(0, start) + `[[${selected}]]` + body.slice(end);
          } else {
            newBody = body.slice(0, start) + '[[' + body.slice(end);
          }
          break;

        case 'list': {
          const lineStart = body.lastIndexOf('\n', start - 1) + 1;
          const prefix = body.slice(lineStart).startsWith('- ') ? '' : '- ';
          newBody = body.slice(0, lineStart) + prefix + body.slice(lineStart);
          break;
        }

        case 'heading': {
          const lineStart = body.lastIndexOf('\n', start - 1) + 1;
          const prefix = body.slice(lineStart).startsWith('## ') ? '' : '## ';
          newBody = body.slice(0, lineStart) + prefix + body.slice(lineStart);
          break;
        }

        case 'quote': {
          const lineStart = body.lastIndexOf('\n', start - 1) + 1;
          const prefix = body.slice(lineStart).startsWith('> ') ? '' : '> ';
          newBody = body.slice(0, lineStart) + prefix + body.slice(lineStart);
          break;
        }

        case 'code':
          if (selected) {
            newBody = body.slice(0, start) + `\`${selected}\`` + body.slice(end);
          } else {
            newBody = body.slice(0, start) + '`code`' + body.slice(end);
          }
          break;
      }

      setBody(newBody);
      // Keep focus on body editor
      setTimeout(() => bodyRef.current?.focus(), 50);
    },
    [body],
  );

  // ── Wikilink autocomplete ───────────────────────────────────────────────────

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

  const insertWikilink = useCallback(
    (targetTitle: string) => {
      const lastAt = body.lastIndexOf('[[');
      setBody(body.slice(0, lastAt) + `[[${targetTitle}]]`);
      setShowSuggestions(false);
    },
    [body],
  );

  // ── Tags ────────────────────────────────────────────────────────────────────

  const addTag = useCallback(
    (tag: string) => {
      const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
      if (!clean || tags.includes(clean)) return;
      setTags(prev => [...prev, clean]);
      setTagInput('');
    },
    [tags],
  );

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  // ── Save / Discard ──────────────────────────────────────────────────────────

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

  // ── AI ──────────────────────────────────────────────────────────────────────

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
        ? `I'm writing a note titled "${title || 'Untitled'}". Here's what I have:\n\n${body}\n\nHelp me continue or improve it.`
        : '',
    });
  }, [navigation, title, body]);

  // ── Word count ──────────────────────────────────────────────────────────────
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const charCount = body.length;

  // ── Toolbar items ───────────────────────────────────────────────────────────
  // IMPORTANT: Material Icons use underscores, not hyphens
  const TOOLBAR = [
    { icon: 'link',                 label: 'Link',   type: 'link'    as const },
    { icon: 'format_bold',          label: 'Bold',   type: 'bold'    as const },
    { icon: 'format_italic',        label: 'Italic', type: 'italic'  as const },
    { icon: 'format_list_bulleted', label: 'List',   type: 'list'    as const },
    { icon: 'title',                label: 'H2',     type: 'heading' as const },
    { icon: 'format_quote',         label: 'Quote',  type: 'quote'   as const },
    { icon: 'code',                 label: 'Code',   type: 'code'    as const },
  ] as const;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleDiscard}
          style={[styles.iconBtn, { backgroundColor: colors.card }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>New note</Text>

        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: saving ? colors.accentDim : colors.accent }]}
          disabled={saving}
          activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Icon name="check" size={18} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Title ── */}
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
          maxLength={200}
        />

        {/* ── Formatting toolbar ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.toolbarScroll, { borderBottomColor: colors.border }]}
          contentContainerStyle={styles.toolbarContent}>
          {TOOLBAR.map(({ icon, label, type }) => (
            <TouchableOpacity
              key={label}
              style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => applyFormat(type)}
              activeOpacity={0.7}>
              <Icon name={icon} size={18} color={colors.accent} />
              <Text style={[styles.toolLabel, { color: colors.muted }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Body ── */}
        <TextInput
          ref={bodyRef}
          style={[styles.bodyInput, { color: colors.text }]}
          value={body}
          onChangeText={handleBodyChange}
          onSelectionChange={handleSelectionChange}
          placeholder={'Start writing…\n\nTip: type [[ to link to another note'}
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
          autoCapitalize="sentences"
        />

        {/* ── Word / char count ── */}
        {body.length > 0 && (
          <View style={styles.statsRow}>
            <Text style={[styles.statsText, { color: colors.muted }]}>
              {wordCount} {wordCount === 1 ? 'word' : 'words'}  ·  {charCount} chars
            </Text>
          </View>
        )}

        {/* ── Wikilink autocomplete ── */}
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
                  <Icon name="insert_link" size={16} color={colors.accent} />
                  <Text style={[styles.suggestText, { color: colors.text }]}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── AI toolbar ── */}
        {body.length > 20 && (
          <View style={[styles.aiBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.aiBarHeader}>
              <Icon name="auto_awesome" size={14} color={colors.accent} />
              <Text style={[styles.aiBarTitle, { color: colors.accent }]}>AI Assistant</Text>
            </View>
            {aiWorking ? (
              <View style={styles.aiBarLoading}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={[styles.aiBarLoadingText, { color: colors.accent }]}>Working…</Text>
              </View>
            ) : (
              <View style={styles.aiBarBtns}>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleAIImprove}
                  activeOpacity={0.75}>
                  <Icon name="auto_fix_high" size={15} color={colors.accent} />
                  <Text style={[styles.aiBtnText, { color: colors.text }]}>Improve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleAIExpand}
                  activeOpacity={0.75}>
                  <Icon name="expand" size={15} color={colors.accent} />
                  <Text style={[styles.aiBtnText, { color: colors.text }]}>Expand</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, styles.aiBtnPrimary, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}
                  onPress={handleAIChat}
                  activeOpacity={0.75}>
                  <Icon name="chat" size={15} color={colors.accent} />
                  <Text style={[styles.aiBtnText, { color: colors.accent }]}>Ask AI</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Tags ── */}
        <View style={[styles.tagsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.tagsHeader}>
            <Icon name="label_outline" size={15} color={colors.muted} />
            <Text style={[styles.tagsLabel, { color: colors.muted }]}>Tags</Text>
          </View>

          {tags.length > 0 && (
            <View style={styles.tagChips}>
              {tags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}
                  onPress={() => removeTag(tag)}
                  activeOpacity={0.7}>
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
                style={[styles.quickTag, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => addTag(tag)}
                activeOpacity={0.7}>
                <Icon name="add" size={12} color={colors.muted} />
                <Text style={[styles.quickTagText, { color: colors.textSecondary }]}>{tag}</Text>
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
              style={[styles.tagAddBtn, { backgroundColor: tagInput.trim() ? colors.accent : colors.card, borderColor: colors.border }]}
              onPress={() => addTag(tagInput)}
              disabled={!tagInput.trim()}
              activeOpacity={0.8}>
              <Icon name="add" size={18} color={tagInput.trim() ? '#fff' : colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    minWidth: 80,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  // Title
  titleInput: {
    fontSize: 26,
    fontWeight: '800',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    letterSpacing: -0.5,
  },

  // Formatting toolbar
  toolbarScroll: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    minWidth: 52,
  },
  toolLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Body editor
  bodyInput: {
    fontSize: 16,
    lineHeight: 28,
    minHeight: 200,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    letterSpacing: 0.1,
  },

  // Stats row
  statsRow: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  statsText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // Wikilink suggestions
  suggestBox: {
    marginHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 160,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestText: { fontSize: 14, fontWeight: '500' },

  // AI bar
  aiBar: {
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  aiBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiBarTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  aiBarLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  aiBarLoadingText: { fontSize: 13, fontWeight: '600' },
  aiBarBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  aiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  aiBtnPrimary: {},
  aiBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Tags section
  tagsSection: {
    margin: 18,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  tagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  tagsLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipText: { fontSize: 12, fontWeight: '700' },
  quickTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  quickTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  quickTagText: { fontSize: 12 },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagInput: {
    flex: 1,
    fontSize: 13,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  tagAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
