import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Switch, Linking, ActivityIndicator,
} from 'react-native';
import { useAlert } from '../theme/AlertContext';
import { useNavigation } from '@react-navigation/native';
import { Store } from '../store/mmkv';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

// ─── small layout helpers ────────────────────────────────────────────────────

function SectionLabel({ text, colors }: { text: string; colors: any }) {
  return <Text style={[s.sectionLabel, { color: colors.muted }]}>{text}</Text>;
}

function Card({ children, colors }: { children: React.ReactNode; colors: any }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function Divider({ colors }: { colors: any }) {
  return <View style={[s.divider, { backgroundColor: colors.border }]} />;
}

// ─── Backup section ──────────────────────────────────────────────────────────

function BackupSection({ colors }: { colors: any }) {
  const navigation = useNavigation<any>();
  const { showAlert } = useAlert();
  const [googleUser, setGoogleUser] = useState<{ email: string; name: string } | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    GoogleDriveService.getCurrentUser().then(u => {
      setGoogleUser(u);
      setLoadingUser(false);
    });
    Store.getLastGoogleBackupAt().then(setLastBackup);
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday
      ? `Today ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleBackupNow = async () => {
    const passphrase = await Store.getSyncPassphrase();
    if (!passphrase) {
      showAlert({
        title: 'No passphrase',
        message: 'Passphrase missing — please set up backup again.',
        icon: 'warning-amber',
      });
      return;
    }
    setSyncing(true);
    try {
      await GoogleDriveService.backup(passphrase);
      const ts = Date.now();
      setLastBackup(ts);
      showAlert({
        title: 'Backed up',
        message: 'Notes saved to Google Drive.',
        icon: 'cloud-done',
      });
    } catch (e: any) {
      showAlert({
        title: 'Backup failed',
        message: e?.message ?? 'Unknown error',
        icon: 'error-outline',
      });
    } finally { setSyncing(false); }
  };

  const handleSignOut = () => {
    showAlert({
      title: 'Disable backup?',
      message: 'You can re-enable it anytime.',
      icon: 'cloud-off',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out', style: 'destructive', onPress: async () => {
            await GoogleDriveService.signOut();
            setGoogleUser(null);
            setLastBackup(null);
          },
        },
      ],
    });
  };

  return (
    <View>
      <SectionLabel text="💾  BACKUP" colors={colors} />
      <Card colors={colors}>
        {loadingUser ? (
          <View style={s.row}>
            <ActivityIndicator color={colors.accent} style={{ margin: 8 }} />
          </View>
        ) : googleUser ? (
          // ── Connected ──
          <>
            <View style={s.row}>
              <View style={[s.iconBox, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                <Icon name="cloud-done" size={18} color="#22c55e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.text }]}>{googleUser.name}</Text>
                <Text style={[s.rowSub, { color: colors.textSecondary }]}>{googleUser.email}</Text>
              </View>
            </View>

            <Divider colors={colors} />

            <View style={[s.statusRow, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <Icon name="check-circle" size={14} color="#22c55e" />
              <Text style={[s.statusText, { color: '#22c55e' }]}>Auto-backup enabled</Text>
            </View>

            {lastBackup && (
              <Text style={[s.backupTime, { color: colors.muted }]}>
                Last backup: {formatTime(lastBackup)}
              </Text>
            )}

            <Divider colors={colors} />

            <TouchableOpacity
              style={[s.row, syncing && { opacity: 0.5 }]}
              onPress={handleBackupNow}
              disabled={syncing}>
              <View style={[s.iconBox, { backgroundColor: colors.accentSoft }]}>
                {syncing
                  ? <ActivityIndicator color={colors.accent} size="small" />
                  : <Icon name="backup" size={18} color={colors.accent} />}
              </View>
              <Text style={[s.rowTitle, { color: colors.text }]}>Back up now</Text>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </TouchableOpacity>

            <Divider colors={colors} />

            <TouchableOpacity style={s.row} onPress={handleSignOut}>
              <View style={[s.iconBox, { backgroundColor: 'rgba(255,85,85,0.1)' }]}>
                <Icon name="logout" size={18} color={colors.danger} />
              </View>
              <Text style={[s.rowTitle, { color: colors.danger }]}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          // ── Not connected ──
          <>
            <View style={s.backupIntro}>
              <Text style={[s.introTitle, { color: colors.text }]}>
                Save your notes to Google Drive
              </Text>
              <Text style={[s.introSub, { color: colors.textSecondary }]}>
                Encrypted backup, automatic after every save. Stored only in your Drive — we never see it.
              </Text>
            </View>

            <Divider colors={colors} />

            <TouchableOpacity
              style={[s.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate('BackupSetup')}
              activeOpacity={0.8}>
              <Text style={s.googleG}>G</Text>
              <Text style={[s.googleBtnText, { color: colors.text }]}>Sign in with Google</Text>
            </TouchableOpacity>

            <Text style={[s.privacyNote, { color: colors.muted }]}>
              🔒 Stored only in your Drive. We never see it.
            </Text>
          </>
        )}
      </Card>
    </View>
  );
}

// ─── AI section ──────────────────────────────────────────────────────────────

function AISection({ colors }: { colors: any }) {
  const [savedKey, setSavedKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Store.getGeminiApiKey().then(k => {
      console.log('[AISettings] Loaded key:', k ? k.slice(0, 8) + '••••••••' : 'none');
      setSavedKey(k ?? '');
      setLoading(false);
    });
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    Store.setGeminiApiKey(trimmed);
    console.log('[AISettings] API key saved:', trimmed.slice(0, 8) + '••••••••');
    setSavedKey(trimmed);
    setInputKey('');
    setEditing(false);
  }, [inputKey]);

  const handleGetKey = () => {
    Linking.openURL('https://aistudio.google.com/app/apikey');
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setInputKey('');
  };

  if (loading) return null;

  const hasKey = savedKey.length > 0;
  const showInput = !hasKey || editing;

  return (
    <View>
      <SectionLabel text="🤖  AI ASSISTANT" colors={colors} />
      <Card colors={colors}>
        {hasKey && !editing ? (
          // ── Key is active ──
          <>
            <View style={s.row}>
              <View style={[s.iconBox, { backgroundColor: colors.accentSoft }]}>
                <Icon name="auto-awesome" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.activeLabel, { color: colors.accent }]}>✅  AI is active</Text>
                <Text style={[s.maskedKey, { color: colors.textSecondary }]}>
                  {savedKey.slice(0, 8)}{'•'.repeat(8)}
                </Text>
              </View>
            </View>
            <Divider colors={colors} />
            <TouchableOpacity style={s.row} onPress={() => setEditing(true)}>
              <View style={[s.iconBox, { backgroundColor: colors.accentSoft }]}>
                <Icon name="edit" size={18} color={colors.accent} />
              </View>
              <Text style={[s.rowTitle, { color: colors.text }]}>Change key</Text>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </TouchableOpacity>
          </>
        ) : (
          // ── No key / editing ──
          <>
            <View style={s.aiIntro}>
              {!hasKey && (
                <>
                  <Text style={[s.introTitle, { color: colors.text }]}>Gemini API Key</Text>
                  <Text style={[s.introSub, { color: colors.textSecondary }]}>
                    Add a free key to enable AI summaries, tag suggestions, and smart search.
                  </Text>
                </>
              )}
              {editing && (
                <Text style={[s.introTitle, { color: colors.text }]}>Change API Key</Text>
              )}
            </View>

            <TextInput
              style={[s.keyInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
              value={inputKey}
              onChangeText={setInputKey}
              placeholder="AIza..."
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {inputKey.length > 0 && (
              <TouchableOpacity
                style={[s.saveKeyBtn, { backgroundColor: colors.accent }]}
                onPress={handleSave}>
                <Icon name="check" size={16} color="#fff" />
                <Text style={s.saveKeyBtnText}>Save Key</Text>
              </TouchableOpacity>
            )}

            {editing && (
              <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={handleCancelEdit}>
                <Text style={[s.cancelBtnText, { color: colors.muted }]}>Cancel</Text>
              </TouchableOpacity>
            )}

            <Divider colors={colors} />

            <TouchableOpacity style={s.row} onPress={handleGetKey}>
              <View style={[s.iconBox, { backgroundColor: colors.accentSoft }]}>
                <Icon name="open-in-new" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.text }]}>Don't have a key?</Text>
                <Text style={[s.rowSub, { color: colors.accent }]}>Get free key → aistudio.google.com</Text>
              </View>
            </TouchableOpacity>

            <Divider colors={colors} />

            <View style={[s.quotaRow, { backgroundColor: colors.accentSoft }]}>
              <Icon name="info-outline" size={13} color={colors.accent} />
              <Text style={[s.quotaText, { color: colors.accent }]}>
                Free: 1,500 req/day · 15/min · No credit card
              </Text>
            </View>

            <Text style={[s.privacyNote, { color: colors.muted }]}>
              🔒 Key is stored only on your device. Never transmitted.
            </Text>
          </>
        )}
      </Card>
    </View>
  );
}

// ─── Appearance section ──────────────────────────────────────────────────────

function AppearanceSection({ colors, isDark, toggle }: { colors: any; isDark: boolean; toggle: () => void }) {
  return (
    <View>
      <SectionLabel text="⚙️  SETTINGS" colors={colors} />
      <Card colors={colors}>
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: colors.accentSoft }]}>
            <Icon name={isDark ? 'dark-mode' : 'light-mode'} size={18} color={colors.accent} />
          </View>
          <Text style={[s.rowTitle, { color: colors.text }]}>Dark mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggle}
            trackColor={{ false: colors.border, true: colors.accentDim }}
            thumbColor={isDark ? colors.accent : colors.muted}
          />
        </View>
        <Divider colors={colors} />
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: colors.accentSoft }]}>
            <Icon name="info" size={18} color={colors.accent} />
          </View>
          <Text style={[s.rowTitle, { color: colors.text }]}>Second Brain</Text>
          <Text style={[s.rowValue, { color: colors.muted }]}>v1.0 — Free</Text>
        </View>
      </Card>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const { colors, isDark, toggle } = useTheme();

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={s.content}>

      <Text style={[s.screenTitle, { color: colors.text }]}>Settings</Text>

      <BackupSection colors={colors} />
      <AISection colors={colors} />
      <AppearanceSection colors={colors} isDark={isDark} toggle={toggle} />

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  screenTitle: { fontSize: 28, fontWeight: '800', marginBottom: 24, marginLeft: 4 },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginLeft: 4, marginTop: 8,
  },

  card: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginBottom: 20,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowValue: { fontSize: 13, fontWeight: '500' },

  divider: { height: 1, marginLeft: 64 },

  // Backup
  backupIntro: { padding: 16, paddingBottom: 12 },
  introTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  introSub: { fontSize: 13, lineHeight: 19 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    margin: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  googleG: { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleBtnText: { fontSize: 15, fontWeight: '600' },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginVertical: 10,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  backupTime: { fontSize: 12, marginHorizontal: 16, marginBottom: 10, marginTop: -4 },

  privacyNote: { fontSize: 12, margin: 16, marginTop: 0, lineHeight: 17 },

  // AI
  aiIntro: { padding: 16, paddingBottom: 8 },
  activeLabel: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  maskedKey: { fontSize: 13, fontFamily: 'monospace' },

  keyInput: {
    marginHorizontal: 16, marginBottom: 10, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
  },
  saveKeyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginHorizontal: 16, marginBottom: 8, paddingVertical: 13, borderRadius: 12,
  },
  saveKeyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    alignItems: 'center', marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 11, borderRadius: 12, borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },

  quotaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  quotaText: { fontSize: 12, fontWeight: '600', flex: 1 },
});
