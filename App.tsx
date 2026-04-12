import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DatabaseService } from './src/db/DatabaseService';
import { NotificationService } from './src/services/NotificationService';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme';
import { AlertProvider } from './src/theme/AlertContext';
import { GoogleDriveService } from './src/services/GoogleDriveService';

GoogleDriveService.configure();

function AppInner() {
  const { isDark, colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await DatabaseService.init();
        await NotificationService.requestPermission();
        // Schedule daily resurface notification (non-blocking)
        NotificationService.scheduleDailyResuface().catch(() => {});
        setReady(true);
      } catch (e: unknown) {
        console.error('[App] init failed', e);
        setError(String(e instanceof Error ? e.message : e));
      }
    }
    init();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Startup error</Text>
        <Text style={styles.errorMsg}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Second Brain</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.bg} />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AlertProvider>
        <AppInner />
      </AlertProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#7c6af7', fontSize: 24, fontWeight: '700', letterSpacing: 1 },
  errorContainer: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', padding: 24 },
  errorTitle: { color: '#f55', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorMsg: { color: '#aaa', fontSize: 13 },
});
