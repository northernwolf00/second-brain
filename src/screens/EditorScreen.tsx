import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, FlatList,
  ActivityIndicator, 
} from 'react-native';
import { useAlert } from '../theme/AlertContext';
import { Dialog } from '../components/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  RichText,
  useEditorBridge,
  useBridgeState,
  useEditorContent,
  TenTapStartKit,
} from '@10play/tentap-editor';
import { NoteService } from '../services/NoteService';
import { Note } from '../types';
import { Store } from '../store/mmkv';
import { useAI } from '../hooks/useAI';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

const QUICK_TAGS = ['idea', 'todo', 'journal', 'research', 'book', 'meeting', 'quote'];

// ── Editor CSS ────────────────────────────────────────────────────────────────
function buildEditorCSS(
  bg: string, text: string, textSecondary: string,
  muted: string, accent: string, isDark: boolean,
) {
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

export function EditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { noteId } = route.params as { noteId: string | null };
  const { colors, isDark } = useTheme();
  const { showAlert } = useAlert();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Note[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // null  = still loading from DB
  // ''    = new / empty note
  // '...' = loaded HTML content
  const [noteBody, setNoteBody] = useState<string | null>(null);

  // Skip the first htmlContent emission so we don't immediately re-save a just-opened note.
  const skipNextSave = useRef(true);
  // Ensure setContent is only called once after the editor is ready.
  const contentSet = useRef(false);

  const { summary: aiSummary, tags: aiTags, loading: aiLoading, analyzeNote } = useAI();
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentNoteId = useRef<string | null>(noteId);

  // ── Load note from DB ─────────────────────────────────────────────────────
  useEffect(() => {
    if (noteId) {
      NoteService.getNoteById(noteId).then(n => {
        if (n) {
          setNote(n);
          setTitle(n.title);
          setNoteBody(n.body ?? '');   // body is now the initial content
          Store.setLastOpenedNoteId(n.id);
        } else {
          setNoteBody('');             // note not found → open empty
        }
      });
      NoteService.getBacklinks(noteId).then(setBacklinks);
    } else {
      setNoteBody('');                 // new note opened directly
    }
  }, [noteId]);

  // ── Rich text editor ──────────────────────────────────────────────────────
  // KEY FIX: pass noteBody as initialContent so content is baked into the
  // WebView BEFORE it initialises — no setContent() timing race possible.
  // We only render <RichText> once noteBody is loaded (see JSX below) so
  // noteBody is always the real value when the WebView first mounts.
  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    bridgeExtensions: TenTapStartKit,
    dynamicHeight: true,
    initialContent: noteBody ?? undefined,
  });

  const editorState = useBridgeState(editor);
  const htmlContent = useEditorContent(editor, { type: 'html', debounceInterval: 200 });

  // Plain text for word count, wikilink detection, AI
  const plainText = (htmlContent ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  // ── Inject CSS and set content when editor becomes ready ─────────────────
  useEffect(() => {
    if (!editorState.isReady) return;
    editor.injectCSS(
      buildEditorCSS(colors.bg, colors.text, colors.textSecondary, colors.muted, colors.accent, isDark),
      'app-theme',
    );
    editor.setPlaceholder('Start writing… click "Wiki" or type [[ to link notes');

    // noteBody is guaranteed non-null here because <RichText> is only rendered
    // when noteBody !== null, and isReady can only become true after <RichText> mounts.
    if (!contentSet.current && noteBody) {
      contentSet.current = true;
      skipNextSave.current = true; // skip the htmlContent emission from setContent
      editor.setContent(noteBody);
    }
  }, [editorState.isReady, noteBody]);

  // Re-inject on theme change
  useEffect(() => {
    if (!editorState.isReady) return;
    editor.injectCSS(
      buildEditorCSS(colors.bg, colors.text, colors.textSecondary, colors.muted, colors.accent, isDark),
      'app-theme',
    );
  }, [isDark, editorState.isReady]);

  // ── Hide native nav header ────────────────────────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ── Save ──────────────────────────────────────────────────────────────────
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
      showAlert({
        title: 'Save failed',
        message: String(e instanceof Error ? e.message : e),
        icon: 'error-outline',
      });
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const currentHtml = await editor.getHTML();
    await save(title, currentHtml ?? '');
    navigation.goBack();
  }, [save, title, editor, navigation]);

  const scheduleAutoSave = useCallback((t: string, b: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(t, b), 2000);
  }, [save]);

  // Auto-save on content change (skip the very first emission = initial load)
  useEffect(() => {
    if (htmlContent === undefined) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    scheduleAutoSave(title, htmlContent);
  }, [htmlContent]);

  // Auto-save on title change
  const handleTitleChange = useCallback((text: string) => {
    setTitle(text);
    scheduleAutoSave(text, htmlContent ?? '');
  }, [htmlContent, scheduleAutoSave]);

  // Save on unmount — use refs to avoid stale closures
  const titleRef = useRef(title);
  useEffect(() => { titleRef.current = title; }, [title]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      editor.getHTML().then(html => {
        if (titleRef.current || html) save(titleRef.current, html ?? '');
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wikilink autocomplete ─────────────────────────────────────────────────
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
    const html = await editor.getHTML();
    const lastAt = html.lastIndexOf('[[');
    if (lastAt >= 0) {
      const after = html.slice(lastAt + 2);
      const endIdx = after.search(/[<>]|\]\]/);
      let remaining = '';
      if (endIdx >= 0) {
        remaining = after.slice(after.startsWith(']]', endIdx) ? endIdx + 2 : endIdx);
      }
      const newHtml = html.slice(0, lastAt) + `[[${targetTitle}]]` + remaining;
      editor.setContent(newHtml);
    }
    setShowSuggestions(false);
  }, [editor]);

  // ── Link ──────────────────────────────────────────────────────────────────
  const handleLinkPress = useCallback(() => {
    if (editorState.isLinkActive) { editor.setLink(null); return; }
    setLinkInput(editorState.activeLink ?? '');
    setShowLinkModal(true);
  }, [editor, editorState.isLinkActive, editorState.activeLink]);

  const confirmLink = useCallback(() => {
    const url = linkInput.trim();
    if (url) editor.setLink(/^https?:\/\//.test(url) ? url : `#wiki:${url}`);
    setShowLinkModal(false);
    setLinkInput('');
  }, [editor, linkInput]);

  // ── AI ────────────────────────────────────────────────────────────────────
  const handleAIAnalyze = useCallback(() => {
    analyzeNote(title, plainText);
  }, [title, plainText, analyzeNote]);

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

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const TOOLBAR = [
    { icon: 'format-bold'          as const, label: 'Bold',   active: editorState.isBoldActive,       action: () => editor.toggleBold() },
    { icon: 'format-italic'        as const, label: 'Italic', active: editorState.isItalicActive,     action: () => editor.toggleItalic() },
    { icon: 'title'                as const, label: 'H2',     active: editorState.headingLevel === 2, action: () => editor.toggleHeading(2) },
    { icon: 'format-list-bulleted' as const, label: 'List',   active: editorState.isBulletListActive, action: () => editor.toggleBulletList() },
    { icon: 'format-quote'         as const, label: 'Quote',  active: editorState.isBlockquoteActive, action: () => editor.toggleBlockquote() },
    { icon: 'code'                 as const, label: 'Code',   active: editorState.isCodeActive,       action: () => editor.toggleCode() },
    { icon: 'link'                 as const, label: 'Link',   active: editorState.isLinkActive,       action: handleLinkPress },
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.iconBtn, { backgroundColor: colors.card }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrow-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {title || 'Note'}
          </Text>

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>

            {TOOLBAR.map(({ icon, label, active, action }) => (
              <TouchableOpacity
                key={label}
                style={[styles.toolBtn, {
                  backgroundColor: active ? colors.accentSoft : colors.card,
                  borderColor: active ? colors.accent : colors.border,
                }]}
                onPress={action}
                activeOpacity={0.7}>
                <Icon name={icon} size={18} color={active ? colors.accent : colors.textSecondary} />
                <Text style={[styles.toolLabel, { color: active ? colors.accent : colors.muted }]}>{label}</Text>
              </TouchableOpacity>
            ))}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.historyBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: editorState.canUndo ? 1 : 0.35 }]}
              onPress={() => editor.undo()} disabled={!editorState.canUndo} activeOpacity={0.7}>
              <Icon name="undo" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.historyBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: editorState.canRedo ? 1 : 0.35 }]}
              onPress={() => editor.redo()} disabled={!editorState.canRedo} activeOpacity={0.7}>
              <Icon name="redo" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

          </ScrollView>
        </View>

        {/* ── Body ── */}
        <ScrollView
          style={styles.scroll}
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Title */}
          <TextInput
            style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Title"
            placeholderTextColor={colors.muted}
            returnKeyType="next"
            onSubmitEditing={() => editor.focus('end')}
            blurOnSubmit={false}
          />

          {/* Rich text — only rendered once noteBody is loaded so
              initialContent is always the real body when WebView mounts */}
          <View style={[styles.editorWrap, { backgroundColor: colors.bg }]}>
            {noteBody === null ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : (
              <RichText
                editor={editor}
                scrollEnabled={false}
                style={{ backgroundColor: colors.bg, minHeight: 300 }}
              />
            )}
          </View>

          {/* Wikilink suggestions */}
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
                    <Icon name="insert-link" size={15} color={colors.accent} />
                    <Text style={[styles.suggestText, { color: colors.text }]}>{item.title}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* AI panel */}
          {plainText.length > 100 && (
            <View style={[styles.aiSection, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.aiAnalyzeBtn, { backgroundColor: colors.card, borderColor: colors.accentDim }]}
                onPress={handleAIAnalyze}
                disabled={aiLoading}
                activeOpacity={0.8}>
                <Icon name="auto-awesome" size={15} color={colors.accent} />
                <Text style={[styles.aiAnalyzeBtnText, { color: colors.accent }]}>
                  {aiLoading ? 'Analyzing…' : 'Analyze with AI'}
                </Text>
                {aiLoading && <ActivityIndicator size="small" color={colors.accent} />}
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
              <View style={styles.backlinksHeader}>
                <Icon name="link" size={14} color={colors.muted} />
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>Linked from</Text>
              </View>
              {backlinks.map(bl => (
                <TouchableOpacity
                  key={bl.id}
                  style={[styles.backlinkItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => navigation.push('Editor', { noteId: bl.id })}
                  activeOpacity={0.7}>
                  <Icon name="article" size={14} color={colors.accent} />
                  <Text style={[styles.backlinkText, { color: colors.accent }]}>{bl.title || 'Untitled'}</Text>
                  <Icon name="chevron-right" size={16} color={colors.muted} />
                </TouchableOpacity>
              ))}
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

        {/* Link modal */}
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
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
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

  // Scroll + editor
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  titleInput: {
    fontSize: 24, fontWeight: '800',
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, letterSpacing: -0.4,
  },
  editorWrap: { paddingHorizontal: 14, paddingTop: 6 },
  loadingWrap: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },

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

  // AI panel
  aiSection: {
    marginHorizontal: 18, marginTop: 20,
    paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  aiAnalyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderRadius: 14, padding: 13,
  },
  aiAnalyzeBtnText: { fontSize: 13, fontWeight: '700' },
  summaryBox: { borderRadius: 14, padding: 16, borderWidth: 1 },
  summaryLabel: { fontSize: 10, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  summaryText: { fontSize: 14, lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: '600' },

  // Backlinks
  backlinksSection: {
    marginHorizontal: 18, marginTop: 24,
    paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  backlinksHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  backlinkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  backlinkText: { flex: 1, fontSize: 14, fontWeight: '500' },

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
  linkModal: { width: '100%', borderRadius: 20, padding: 24, borderWidth: 1, gap: 12 },
  linkModalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  linkModalHint: { fontSize: 12, lineHeight: 17 },
  linkModalInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  linkModalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  linkModalBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  linkModalBtnText: { fontSize: 14, fontWeight: '700' },
});
