import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { Store } from '../store/mmkv';
import { useTheme } from '../theme';
import { Icon } from '../components/Icon';

type Step = 'intro' | 'passphrase' | 'done';

export function BackupSetupScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [step, setStep] = useState<Step>('intro');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await GoogleDriveService.signIn();
      setUserName(user.name || user.email);
      setStep('passphrase');
    } catch (e: any) {
      if (e?.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Sign-in failed', e?.message ?? 'Could not sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassphrase = async () => {
    if (passphrase.length < 6) {
      Alert.alert('Too short', 'Use at least 6 characters.');
      return;
    }
    if (passphrase !== confirm) {
      Alert.alert('Mismatch', 'Passphrases do not match.');
      return;
    }
    setLoading(true);
    try {
      await Store.setSyncPassphrase(passphrase);
      // Run first backup immediately
      await GoogleDriveService.backup(passphrase);
      setStep('done');
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'Could not save backup.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="close" size={22} color={colors.muted} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Set up backup</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag">

        {/* ── Step: intro ── */}
        {step === 'intro' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
              <Icon name="cloud-upload" size={40} color={colors.accent} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              Back up to Google Drive
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your notes are encrypted on your device, then saved privately to your Google Drive. Only you can read them.
            </Text>

            <View style={styles.featureList}>
              {[
                { icon: 'lock', text: 'End-to-end encrypted before upload' },
                { icon: 'cloud-done', text: 'Stored in your own Drive — we never see it' },
                { icon: 'sync', text: 'Auto-backup after every save' },
              ].map(f => (
                <View key={f.icon} style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: colors.accentSoft }]}>
                    <Icon name={f.icon} size={16} color={colors.accent} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={[styles.googleBtnText, { color: colors.text }]}>Sign in with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.privacy, { color: colors.muted }]}>
              Only Drive access is requested. No other data is read.
            </Text>
          </>
        )}

        {/* ── Step: passphrase ── */}
        {step === 'passphrase' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
              <Icon name="lock" size={40} color={colors.accent} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Create a passphrase</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Signed in as <Text style={{ color: colors.accent, fontWeight: '700' }}>{userName}</Text>.{'\n\n'}
              Choose a passphrase to encrypt your notes before they reach Google Drive. You'll need this to restore on a new device.
            </Text>

            <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                value={passphrase}
                onChangeText={setPassphrase}
                placeholder="Passphrase (min 6 chars)"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoFocus
              />
              <TextInput
                style={[styles.input, { color: colors.text, borderBottomWidth: 0 }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm passphrase"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSavePassphrase}
              />
            </View>

            <View style={[styles.warningBox, { backgroundColor: 'rgba(255,180,0,0.1)', borderColor: 'rgba(255,180,0,0.3)' }]}>
              <Icon name="warning-amber" size={16} color="#e6a800" />
              <Text style={[styles.warningText, { color: '#e6a800' }]}>
                If you forget this passphrase, your backup cannot be restored.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent }, loading && { opacity: 0.6 }]}
              onPress={handleSavePassphrase}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="backup" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Save & Back up now</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <Icon name="check-circle" size={44} color="#22c55e" />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Backup enabled!</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your notes are now backed up to Google Drive. Future backups happen automatically every time you save a note.
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              onPress={handleDone}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { padding: 24, paddingTop: 32, alignItems: 'center' },

  iconWrap: {
    width: 88, height: 88, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },

  featureList: { alignSelf: 'stretch', marginBottom: 32, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    alignSelf: 'stretch', paddingVertical: 16, borderRadius: 16, borderWidth: 1,
    marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  googleG: { fontSize: 20, fontWeight: '900', color: '#4285F4' },
  googleBtnText: { fontSize: 16, fontWeight: '600' },

  privacy: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

  inputCard: {
    alignSelf: 'stretch', borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', marginBottom: 16,
  },
  input: {
    fontSize: 15, paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1,
  },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    alignSelf: 'stretch', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 28,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', paddingVertical: 16, borderRadius: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
