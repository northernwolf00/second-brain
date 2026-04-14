import React, { useState,  useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, FlatList,
  ActivityIndicator, Pressable,
} from 'react-native';
import { useAlert } from '../theme/AlertContext';
import { Dialog } from '../components/Dialog';
import { useNavigation } from '@react-navigation/native';
import {
  RichText,
  useEditorBridge,
  useBridgeState,
  useEditorContent,
  TenTapStartKit,
} from '@10play/tentap-editor';
import { NoteService } from '../services/NoteService';
import { AIService } from '../services/AIService';
import { Note } from '../types';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme';

const QUICK_TAGS = ['idea', 'todo', 'journal', 'research', 'book', 'meeting', 'quote'];

/** CSS injected into the TipTap WebView to match the app theme */
function buildEditorCSS(bg: string, text: string, textSecondary: string, muted: string, accent: string, isDark: boolean) {
  const codeBg = isDark ? '#21262d' : '#e8e0d0';
  const codeColor = isDark ? '#f97583' : '#c0392b';
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background-color: ${bg} !important; }
    body, .ProseMirror {
      background-color: ${bg} !important;
      color: ${text} !important;
      font-size: 16px;
      line-height: 1.8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      caret-color: ${accent};
      word-break: break-word;
      padding: 2px;
    }
    .ProseMirror:focus { outline: none; }
    .ProseMirror p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: ${muted};
      pointer-events: none;
      position: absolute;
    }
    strong, b { font-weight: 700; }
    em, i { font-style: italic; color: ${textSecondary}; }
    u { text-decoration: underline; }
    s { text-decoration: line-through; color: ${muted}; }
    code {
      background-color: ${codeBg};
      color: ${codeColor};
      border-radius: 4px;
      padding: 1px 6px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
    }
    blockquote {
      border-left: 3px solid ${accent};
      padding-left: 14px;
      margin: 4px 0;
      color: ${textSecondary};
      font-style: italic;
    }
    h1 { font-size: 1.7em; font-weight: 800; margin: 10px 0 6px; color: ${text}; }
    h2 { font-size: 1.4em; font-weight: 700; margin: 10px 0 4px; color: ${text}; }
    h3 { font-size: 1.15em; font-weight: 600; margin: 8px 0 4px; color: ${text}; }
    ul, ol { padding-left: 22px; margin: 4px 0; }
    li { margin-bottom: 3px; line-height: 1.7; }
    p { margin-bottom: 6px; }
    a { color: ${accent}; text-decoration: underline; }
    hr { border-color: ${muted}; opacity: 0.3; margin: 12px 0; }
  `;
}

export function AddNoteScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<Note[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);

  // Link modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkInput, setLinkInput] = useState('');

  // ── Rich text editor ────────────────────────────────────────────────────────
  // TenTapStartKit already includes Bold, Italic, Heading, BulletList, Blockquote,
  // Code, Underline, Link, History, PlaceholderBridge, and more.
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    bridgeExtensions: TenTapStartKit,
    dynamicHeight: true,
  });

  const editorState = useBridgeState(editor);
  // HTML content – used for saving and wikilink detection
  const htmlContent = useEditorContent(editor, { type: 'html', debounceInterval: 200 });

  // Plain text derived from HTML (strip tags)
  const plainText = (htmlContent ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  // ── Inject theme CSS when editor becomes ready ──────────────────────────────
  useEffect(() => {
    if (!editorState.isReady) return;
    editor.injectCSS(
      buildEditorCSS(colors.bg, colors.text, colors.textSecondary, colors.muted, colors.accent, isDark),
      'app-theme',
    );
    editor.setPlaceholder('Start writing…\n\nTip: click "Wiki" in toolbar or type [[ to link to another note');
  }, [colors.accent, colors.bg, colors.muted, colors.text, colors.textSecondary, editor, editorState.isReady, isDark]); // re-inject on theme toggle

  // ── Wikilink autocomplete ───────────────────────────────────────────────────
  useEffect(() => {
    if (!plainText) { setShowSuggestions(false); return; }
    const lastAt = plainText.lastIndexOf('[[');
    if (lastAt >= 0) {
      const after = plainText.slice(lastAt + 2);
      const query = after.split(']]')[0];
      NoteService.searchTitles(query).then(res => {
        setSuggestions(res);
        setShowSuggestions(res.length > 0);
      });
      return;
    }
    setShowSuggestions(false);
  }, [plainText]);

  const insertWikilink = useCallback(async (targetTitle: string) => {
    // Get the current HTML, find [[ and replace with [[title]]
    const html = await editor.getHTML();
    const lastAt = html.lastIndexOf('[[');
    if (lastAt >= 0) {
      const after = html.slice(lastAt + 2);
      // find index of first closing bracket or other tag
      const endIdx = after.search(/[<>]|\]\]/);
      let remaining = '';
      if (endIdx >= 0) {
        // Skip ]] if it matched
        remaining = after.slice(after.startsWith(']]', endIdx) ? endIdx + 2 : endIdx);
      }
      const newHtml = html.slice(0, lastAt) + `[[${targetTitle}]]` + remaining;
      editor.setContent(newHtml);
    }
    setShowSuggestions(false);
  }, [editor]);

  // ── Tags ────────────────────────────────────────────────────────────────────
  const addTag = useCallback((tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!clean || tags.includes(clean)) return;
    setTags(prev => [...prev, clean]);
    setTagInput('');
  }, [tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  // ── Save / Discard ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim() && !plainText) {
      showAlert({
        title: 'Empty note',
        message: 'Add a title or some content before saving.',
        icon: 'info-outline',
      });
      return;
    }
    setSaving(true);
    try {
      const bodyHtml = await editor.getHTML();
      await NoteService.createNote(title.trim() || 'Untitled', bodyHtml ?? '');
      navigation.goBack();
    } catch (e) {
      showAlert({
        title: 'Save failed',
        message: String(e instanceof Error ? e.message : e),
        icon: 'error-outline',
      });
    } finally {
      setSaving(false);
    }
  }, [title, plainText, editor, navigation]);

  const handleDiscard = useCallback(() => {
    if (title || plainText) {
      showAlert({
        title: 'Discard note?',
        message: 'Your unsaved content will be lost.',
        icon: 'help-outline',
        buttons: [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ],
      });
    } else {
      navigation.goBack();
    }
  }, [title, plainText, navigation, showAlert]);

  // ── AI ──────────────────────────────────────────────────────────────────────
  const handleAIImprove = useCallback(async () => {
    if (!plainText) return;
    setAiWorking(true);
    const improved = await AIService.improveText(plainText);
    if (improved) editor.setContent(improved);
    setAiWorking(false);
  }, [editor, plainText]);

  const handleAIExpand = useCallback(async () => {
    if (!plainText) return;
    setAiWorking(true);
    const expanded = await AIService.expandIdea(plainText);
    if (expanded) editor.setContent(expanded);
    setAiWorking(false);
  }, [editor, plainText]);

  const handleAIChat = useCallback(() => {
    navigation.navigate('AIAssistant', {
      text: plainText,
      prompt: plainText
        ? `I'm writing a note titled "${title || 'Untitled'}". Here's what I have:\n\n${plainText}\n\nHelp me continue or improve it.`
        : '',
    });
  }, [navigation, title, plainText]);

  // ── Link handling ───────────────────────────────────────────────────────────
  const handleLinkPress = useCallback(() => {
    if (editorState.isLinkActive) {
      // Toggle off existing link
      editor.setLink(null);
      return;
    }
    // Pre-fill with existing link if any
    setLinkInput(editorState.activeLink ?? '');
    setShowLinkModal(true);
  }, [editor, editorState.isLinkActive, editorState.activeLink]);

  const confirmLink = useCallback(() => {
    const url = linkInput.trim();
    if (url) {
      // If it looks like a URL, use as-is; otherwise treat as wikilink
      const href = /^https?:\/\//.test(url) ? url : `#wiki:${url}`;
      editor.setLink(href);
    }
    setShowLinkModal(false);
    setLinkInput('');
  }, [editor, linkInput]);

  // ── Toolbar config ──────────────────────────────────────────────────────────
  // All actions use the tentap bridge (postMessage) — they work on selected text.
  // The bridge sends commands to the TipTap editor in the WebView.
  const TOOLBAR = [
    {
      icon: 'format-bold' as const,
      label: 'Bold',
      active: editorState.isBoldActive,
      action: () => editor.toggleBold(),
    },
    {
      icon: 'format-italic' as const,
      label: 'Italic',
      active: editorState.isItalicActive,
      action: () => editor.toggleItalic(),
    },
    {
      icon: 'title' as const,
      label: 'H2',
      active: editorState.headingLevel === 2,
      action: () => editor.toggleHeading(2),
    },
    {
      icon: 'format-list-bulleted' as const,
      label: 'List',
      active: editorState.isBulletListActive,
      action: () => editor.toggleBulletList(),
    },
    {
      icon: 'format-quote' as const,
      label: 'Quote',
      active: editorState.isBlockquoteActive,
      action: () => editor.toggleBlockquote(),
    },
    {
      icon: 'code' as const,
      label: 'Code',
      active: editorState.isCodeActive,
      action: () => editor.toggleCode(),
    },
    {
      icon: 'link' as const,
      label: 'Link',
      active: editorState.isLinkActive,
      action: handleLinkPress,
    },
    {
      icon: 'add-link' as const,
      label: 'Wiki',
      active: showSuggestions,
      action: () => {
        // We insert [[]] and place cursor inside at currentPos+2
        editor.injectJS(`
          (function() {
            const { from } = this.editor.state.selection;
            this.editor.chain().focus().insertContent('[[]]').setTextSelection(from + 2).run();
          }).call(this);
        `);
      },
    },
  ];

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

        {wordCount > 0 && (
          <Text style={[styles.wordCount, { color: colors.muted }]}>{wordCount}w</Text>
        )}

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

      {/* ── Formatting toolbar ── */}
      <View style={[styles.toolbarWrapper, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}>

          {TOOLBAR.map(({ icon, label, active, action }) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.toolBtn,
                {
                  backgroundColor: active ? colors.accentSoft : colors.card,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
              onPress={action}
              activeOpacity={0.7}>
              <Icon
                name={icon}
                size={18}
                color={active ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.toolLabel, { color: active ? colors.accent : colors.muted }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Undo */}
          <TouchableOpacity
            style={[styles.historyBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: editorState.canUndo ? 1 : 0.35 }]}
            onPress={() => editor.undo()}
            disabled={!editorState.canUndo}
            activeOpacity={0.7}>
            <Icon name="undo" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Redo */}
          <TouchableOpacity
            style={[styles.historyBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: editorState.canRedo ? 1 : 0.35 }]}
            onPress={() => editor.redo()}
            disabled={!editorState.canRedo}
            activeOpacity={0.7}>
            <Icon name="redo" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Title ── */}
        <TextInput
          style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.muted}
          returnKeyType="next"
          onSubmitEditing={() => editor.focus('end')}
          blurOnSubmit={false}
          autoFocus
          maxLength={200}
        />

        {/* ── Rich text body editor ── */}
        <View style={[styles.editorWrap, { backgroundColor: colors.bg }]}>
          <RichText
            editor={editor}
            scrollEnabled={false}
            style={{ backgroundColor: colors.bg, minHeight: 220 }}
          />
        </View>

        {/* ── Wikilink autocomplete ── */}
        {showSuggestions && (
          <View style={[styles.suggestBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <FlatList
              data={suggestions}
              keyExtractor={n => n.id}
              keyboardShouldPersistTaps="always"
              scrollEnabled={false}
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

        {/* ── AI bar ── */}
        {plainText.length > 20 && (
          <View style={[styles.aiBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.aiBarHeader}>
              <Icon name="auto-awesome" size={14} color={colors.accent} />
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
                  onPress={handleAIImprove} activeOpacity={0.75}>
                  <Icon name="auto-fix-high" size={15} color={colors.accent} />
                  <Text style={[styles.aiBtnText, { color: colors.text }]}>Improve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleAIExpand} activeOpacity={0.75}>
                  <Icon name="expand" size={15} color={colors.accent} />
                  <Text style={[styles.aiBtnText, { color: colors.text }]}>Expand</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}
                  onPress={handleAIChat} activeOpacity={0.75}>
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
            <Icon name="label-outline" size={15} color={colors.muted} />
            <Text style={[styles.tagsLabel, { color: colors.muted }]}>Tags</Text>
          </View>

          {tags.length > 0 && (
            <View style={styles.tagChips}>
              {tags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}
                  onPress={() => removeTag(tag)} activeOpacity={0.7}>
                  <Text style={[styles.tagChipText, { color: colors.accent }]}>#{tag}</Text>
                  <Icon name="close" size={11} color={colors.accent} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.quickTags}>
            {QUICK_TAGS.filter(t => !tags.includes(t)).map(tag => (
              <TouchableOpacity
                key={tag}
                style={[styles.quickTag, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => addTag(tag)} activeOpacity={0.7}>
                <Icon name="add" size={12} color={colors.muted} />
                <Text style={[styles.quickTagText, { color: colors.textSecondary }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
              style={[styles.tagAddBtn, {
                backgroundColor: tagInput.trim() ? colors.accent : colors.card,
                borderColor: colors.border,
              }]}
              onPress={() => addTag(tagInput)}
              disabled={!tagInput.trim()} activeOpacity={0.8}>
              <Icon name="add" size={18} color={tagInput.trim() ? '#fff' : colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* ── Link input modal ── */}
      <Dialog
        visible={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        title="Insert Link"
        message="Paste a URL or type a note title to create a wikilink"
        icon="link"
        content={
          <TextInput
            style={[styles.linkModalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
            value={linkInput}
            onChangeText={setLinkInput}
            placeholder="https://… or note title"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={confirmLink}
          />
        }
        buttons={[
          { text: 'Cancel', style: 'cancel', onPress: () => setLinkInput('') },
          { text: 'Insert', style: 'default', onPress: confirmLink },
        ]}
      />

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  wordCount: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 12, minWidth: 82, justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },

  // Toolbar
  toolbarWrapper: { borderBottomWidth: StyleSheet.hairlineWidth },
  toolbarContent: {
    flexDirection: 'row', paddingHorizontal: 12,
    paddingVertical: 9, gap: 7, alignItems: 'center',
  },
  toolBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, gap: 3, minWidth: 48,
  },
  toolLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  divider: { width: StyleSheet.hairlineWidth, height: 30, marginHorizontal: 4 },
  historyBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  // Title
  titleInput: {
    fontSize: 26, fontWeight: '800',
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, letterSpacing: -0.5,
  },

  // Rich text editor (WebView)
  editorWrap: { paddingHorizontal: 14, paddingTop: 6 },

  // Wikilink suggestions
  suggestBox: {
    marginHorizontal: 18, borderRadius: 12, borderWidth: 1,
    maxHeight: 160, marginBottom: 8, overflow: 'hidden',
  },
  suggestItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestText: { fontSize: 14, fontWeight: '500' },

  // AI bar
  aiBar: {
    marginHorizontal: 18, marginTop: 8, marginBottom: 8,
    borderRadius: 16, borderWidth: 1, padding: 14, gap: 10,
  },
  aiBarHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiBarTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  aiBarLoading: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 4,
  },
  aiBarLoadingText: { fontSize: 13, fontWeight: '600' },
  aiBarBtns: { flexDirection: 'row', gap: 8 },
  aiBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
  },
  aiBtnText: { fontSize: 12, fontWeight: '700' },

  // Tags
  tagsSection: { margin: 18, marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  tagsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  tagsLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  tagChipText: { fontSize: 12, fontWeight: '700' },
  quickTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  quickTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20,
  },
  quickTagText: { fontSize: 12 },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagInput: { flex: 1, fontSize: 13, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  tagAddBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  // Link modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
  },
  linkModal: {
    width: '100%', borderRadius: 20, padding: 24, borderWidth: 1, gap: 12,
  },
  linkModalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  linkModalHint: { fontSize: 12, lineHeight: 17 },
  linkModalInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14,
  },
  linkModalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  linkModalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  linkModalBtnPrimary: {},
  linkModalBtnText: { fontSize: 14, fontWeight: '700' },
});
