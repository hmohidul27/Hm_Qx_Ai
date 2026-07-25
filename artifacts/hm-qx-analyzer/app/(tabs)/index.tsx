import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import Dashboard from '@/components/Dashboard';
import BrowserView from '@/components/BrowserView';
import FloatingBubble from '@/components/FloatingBubble';
import SignalAlert from '@/components/SignalAlert';
import ScanStatusBar from '@/components/ScanStatusBar';

export default function MainScreen() {
  const { view, signal, isScanning, scanStatus } = useApp();
  const insets = useSafeAreaInsets();

  if (view === 'dashboard') {
    return <Dashboard />;
  }

  // Analyzer view
  return (
    <View style={[styles.analyzerContainer, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#080510" />

      {/* Status bar at top */}
      <ScanStatusBar message={scanStatus} isScanning={isScanning} />

      {/* WebView browser */}
      <BrowserView />

      {/* Floating scan bubble — always on top */}
      <FloatingBubble />

      {/* Signal alert popup */}
      {signal && <SignalAlert signal={signal} />}
    </View>
  );
}

const styles = StyleSheet.create({
  analyzerContainer: {
    flex: 1,
    backgroundColor: '#080510',
  },
});
