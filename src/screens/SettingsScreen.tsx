import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Store } from '../store/mmkv';
import { SyncService } from '../services/SyncService';

const COLORS = { bg: '#0f0f0f', card: '#1a1a1a', accent: '#7c6af7', text: '#f0f0f0', muted: '#666', border: '#2a2a2a', danger: '#f55' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ label, value, onPress, destructive }: { label: string; value?: string; onPress?: () => void; destructive?: boolean }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.rowLabel, destructive && { color: COLORS.danger }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const [passphrase, setPassphrase] = useState(Store.getSyncPassphrase() ?? '');
  const [syncing, setSyncing] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{ exists: boolean; size: number; mtime: Date | null } | null>(null);
  const lastSync = Store.getLastSyncAt();

  useEffect(() => {
    SyncService.getBackupInfo().then(setBackupInfo);
  }, []);

  const handleExport = async () => {
    if (!passphrase.trim()) {
      Alert.alert('Set passphrase', 'Enter a passphrase before exporting.');
      return;
    }
    setSyncing(true);
    try {
      await SyncService.exportEncrypted(passphrase.trim());
      Store.setSyncPassphrase(passphrase.trim());
      Store.setLastSyncAt(Date.now());
      const info = await SyncService.getBackupInfo();
      setBackupInfo(info);
      Alert.alert('Backup saved', `Saved to ${SyncService.backupPath()}\n\nEnable iCloud Drive sync in iOS Settings to sync automatically.`);
    } catch (e: unknown) {
      Alert.alert('Export failed', String(e instanceof Error ? e.message : e));
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async () => {
    if (!passphrase.trim()) {
      Alert.alert('Set passphrase', 'Enter the passphrase used when exporting.');
      return;
    }
    Alert.alert('Import backup', 'This will merge the backup into your current notes (last-write-wins). Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: async () => {
          setSyncing(true);
          try {
            const { imported, skipped } = await SyncService.importEncrypted(passphrase.trim());
            Alert.alert('Import complete', `${imported} notes imported, ${skipped} already up to date.`);
          } catch (e: unknown) {
            Alert.alert('Import failed', String(e instanceof Error ? e.message : e));
          } finally {
            setSyncing(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Section title="Encrypted backup">
        <View style={styles.passphraseRow}>
          <TextInput
            style={styles.passphraseInput}
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Encryption passphrase"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        <Row
          label={syncing ? 'Working…' : 'Export encrypted backup'}
          onPress={syncing ? undefined : handleExport}
        />

        {backupInfo?.exists && (
          <Row
            label="Import from backup"
            value={backupInfo.mtime ? backupInfo.mtime.toLocaleDateString() : undefined}
            onPress={syncing ? undefined : handleImport}
          />
        )}

        {lastSync ? (
          <Text style={styles.lastSync}>Last export: {new Date(lastSync).toLocaleString()}</Text>
        ) : null}

        <Text style={styles.syncHint}>
          Backup is saved to your app's Documents folder. On iOS, enable iCloud Drive to sync it across devices.
        </Text>
      </Section>

      <Section title="About">
        <Row label="Second Brain" value="v1.0" />
        <Row label="All features" value="Free" />
      </Section>

      {syncing && (
        <View style={styles.syncOverlay}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { color: COLORS.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { color: COLORS.text, fontSize: 14 },
  rowValue: { color: COLORS.muted, fontSize: 13 },
  passphraseRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  passphraseInput: { color: COLORS.text, fontSize: 14, backgroundColor: '#111', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  lastSync: { color: COLORS.muted, fontSize: 11, padding: 12, paddingTop: 0 },
  syncHint: { color: '#444', fontSize: 11, padding: 12, paddingTop: 4, lineHeight: 16 },
  syncOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
});
