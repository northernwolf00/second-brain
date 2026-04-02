import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // Print full stack to Metro / adb logcat
    console.error('[ErrorBoundary] Uncaught error:', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.label}>{this.props.fallbackLabel ?? 'Screen error'}</Text>
        <ScrollView style={styles.box}>
          <Text style={styles.msg}>{error.message}</Text>
          {!!info?.componentStack && (
            <Text style={styles.stack}>{info.componentStack.trim()}</Text>
          )}
        </ScrollView>
        <TouchableOpacity style={styles.btn} onPress={this.reset}>
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 20,
    justifyContent: 'center',
  },
  title: { color: '#f55', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  label: { color: '#888', fontSize: 13, marginBottom: 12 },
  box: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    maxHeight: 280,
    marginBottom: 16,
  },
  msg: { color: '#ffcc00', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  stack: { color: '#666', fontSize: 10, fontFamily: 'monospace' },
  btn: {
    backgroundColor: '#7c6af7',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
