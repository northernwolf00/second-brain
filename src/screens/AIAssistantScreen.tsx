import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AIService } from '../services/AIService';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  loading?: boolean;
}

const SUGGESTIONS = [
  'Help me brainstorm ideas',
  'How should I structure my notes?',
  'What makes a good daily journal?',
  'Give me a writing prompt',
];

let msgId = 0;
const uid = () => String(++msgId);

export function AIAssistantScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Optional: pre-seeded context from AddNoteScreen
  const initialText: string = route.params?.text ?? '';
  const initialPrompt: string = route.params?.prompt ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AIService.isAvailable().then(setAiReady);
  }, []);

  // If launched with pre-seeded text from AddNoteScreen, send automatically
  useEffect(() => {
    if (initialPrompt && aiReady) {
      sendMessage(initialPrompt, [{ role: 'user', text: initialText }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiReady]);

  const scrollToEnd = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = useCallback(async (
    text: string,
    extra: Array<{ role: 'user' | 'ai'; text: string }> = [],
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: uid(), role: 'user', text: trimmed };
    const loadingMsg: Message = { id: uid(), role: 'ai', text: '', loading: true };

    setMessages(prev => {
      const next = [...prev, userMsg, loadingMsg];
      return next;
    });
    setInput('');
    scrollToEnd();

    const history = [...extra, { role: 'user' as const, text: trimmed }];

    let reply: string | null = null;
    try {
      reply = await AIService.chat(trimmed, history);
      console.log('[AIAssistant] reply:', reply?.slice(0, 80));
    } catch (err) {
      console.warn('[AIAssistant] chat error:', err);
    }

    setMessages(prev =>
      prev.map(m =>
        m.id === loadingMsg.id
          ? { ...m, text: reply ?? "Sorry, I couldn't respond. Check your API key in Settings.", loading: false }
          : m,
      ),
    );
    scrollToEnd();
  }, []);

  const handleSend = useCallback(() => {
    const history = messages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, text: m.text }));
    sendMessage(input, history);
  }, [input, messages, sendMessage]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <Icon name="auto-awesome" size={14} color={colors.accent} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: colors.accent }]
              : [styles.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}>
          {item.loading ? (
            <View style={styles.loadingDots}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={[styles.loadingText, { color: colors.muted }]}>Thinking…</Text>
            </View>
          ) : (
            <Text style={[styles.bubbleText, { color: isUser ? '#fff' : colors.text }]}>
              {item.text}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: colors.accentSoft }]}>
            <Icon name="auto-awesome" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>AI Assistant</Text>
            <Text style={[styles.headerSub, { color: colors.accent }]}>Gemini 2.5 Flash</Text>
          </View>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {/* No API key warning */}
      {aiReady === false && (
        <View style={[styles.noKeyBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accentDim }]}>
          <Icon name="info-outline" size={15} color={colors.accent} />
          <Text style={[styles.noKeyText, { color: colors.accent }]}>
            Add a Gemini API key in Settings to use AI.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Settings' })}>
            <Text style={[styles.noKeyLink, { color: colors.accent }]}>Settings →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={[
          styles.list,
          messages.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name="auto-awesome" size={36} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              What's on your mind?
            </Text>
            <Text style={[styles.emptyHint, { color: colors.muted }]}>
              Ask anything — brainstorm, write, organize, or explore your notes.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestion, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => { setInput(s); inputRef.current?.focus(); }}>
                  <Text style={[styles.suggestionText, { color: colors.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() ? colors.accent : colors.accentSoft },
          ]}
          onPress={handleSend}
          disabled={!input.trim()}
          activeOpacity={0.8}>
          <Icon name="send" size={18} color={input.trim() ? '#fff' : colors.muted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 11, fontWeight: '600' },

  noKeyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  noKeyText: { flex: 1, fontSize: 13 },
  noKeyLink: { fontSize: 13, fontWeight: '700' },

  list: { padding: 16, paddingBottom: 8 },
  listEmpty: { flex: 1 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  emptyHint: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  suggestions: { alignSelf: 'stretch', gap: 10 },
  suggestion: {
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  suggestionText: { fontSize: 14 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  msgRowUser: { flexDirection: 'row-reverse' },

  avatar: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },

  bubble: { maxWidth: '80%', borderRadius: 18, padding: 13 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },

  loadingDots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, borderTopWidth: 1,
  },
  input: {
    flex: 1, fontSize: 15, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
});
