import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

const HOME_SITES = [
  {
    label: 'Quotex',
    url: 'https://market-qx.trade',
    color: '#00ff66',
    icon: 'trending-up' as const,
  },
  {
    label: 'Binolla',
    url: 'https://binolla.com',
    color: '#ffaa00',
    icon: 'logo-bitcoin' as const,
  },
];

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  // Google bypass
  if (trimmed.toLowerCase().includes('google.com')) {
    return 'https://www.google.com/webhp?igu=1';
  }
  // Quotex aliases
  if (
    trimmed.toLowerCase().includes('quotex.com') ||
    trimmed.toLowerCase().includes('qxbroker.com')
  ) {
    return 'https://market-qx.trade';
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export default function BrowserView() {
  const colors = useColors();
  const { setCurrentUrl, setView } = useApp();
  const webViewRef = useRef<WebView>(null);
  const [addressText, setAddressText] = useState('');
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  function loadUrl(url: string) {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    setWebViewUrl(normalized);
    setAddressText(normalized.includes('webhp') ? 'https://www.google.com' : normalized);
    setShowWebView(true);
    setCurrentUrl(normalized);
  }

  function goHome() {
    setShowWebView(false);
    setWebViewUrl('');
    setAddressText('');
  }

  function reload() {
    webViewRef.current?.reload();
  }

  function handleSubmit() {
    loadUrl(addressText);
  }

  return (
    <View style={styles.container}>
      {/* Browser Control Bar */}
      <View style={[styles.browserBar, { backgroundColor: '#0c0613', borderBottomColor: colors.border }]}>
        {/* Home */}
        <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border }]} onPress={goHome}>
          <Ionicons name="home-outline" size={15} color={colors.primary} />
        </TouchableOpacity>

        {/* Back */}
        <TouchableOpacity
          style={[styles.ctrlBtn, { borderColor: colors.border }]}
          onPress={() => setView('dashboard')}
        >
          <MaterialIcons name="dashboard" size={15} color={colors.primary} />
        </TouchableOpacity>

        {/* Reload */}
        <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border }]} onPress={reload}>
          <Ionicons name="refresh" size={15} color={colors.primary} />
        </TouchableOpacity>

        {/* Address Bar */}
        <View style={[styles.addressWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Ionicons name="globe-outline" size={12} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
          <TextInput
            style={[styles.addressInput, { color: colors.foreground }]}
            value={addressText}
            onChangeText={setAddressText}
            onSubmitEditing={handleSubmit}
            placeholder="Search or enter URL..."
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
          />
          <TouchableOpacity onPress={handleSubmit} style={styles.goBtn}>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Viewport */}
      <View style={styles.viewport}>
        {showWebView ? (
          <WebView
            ref={webViewRef}
            source={{ uri: webViewUrl }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onNavigationStateChange={(state) => {
              if (state.url && !state.url.includes('webhp')) {
                setAddressText(state.url);
                setCurrentUrl(state.url);
              }
            }}
          />
        ) : (
          <HomeScreen onLoadUrl={loadUrl} colors={colors} />
        )}
      </View>
    </View>
  );
}

function HomeScreen({
  onLoadUrl,
  colors,
}: {
  onLoadUrl: (url: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={homeStyles.container}>
      <Text style={[homeStyles.heading, { color: colors.primary }]}>Trading Gateway</Text>
      <Text style={[homeStyles.sub, { color: colors.mutedForeground }]}>
        Select a platform to open and analyze
      </Text>

      <View style={homeStyles.siteGrid}>
        {HOME_SITES.map((site) => (
          <TouchableOpacity
            key={site.url}
            style={[homeStyles.siteCard, { borderColor: `${site.color}33`, backgroundColor: `${site.color}0A` }]}
            onPress={() => onLoadUrl(site.url)}
            activeOpacity={0.8}
          >
            <Ionicons name={site.icon} size={28} color={site.color} />
            <Text style={[homeStyles.siteLabel, { color: colors.foreground }]}>{site.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[homeStyles.googleCard, { borderColor: colors.border, backgroundColor: colors.muted }]}
        onPress={() => onLoadUrl('https://www.google.com')}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-google" size={22} color={colors.primary} />
        <Text style={[homeStyles.siteLabel, { color: colors.foreground }]}>Google Search</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  browserBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  ctrlBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressWrapper: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressInput: {
    flex: 1,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 0,
    height: '100%',
  },
  goBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewport: { flex: 1 },
  webView: { flex: 1 },
});

const homeStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#070e14',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sub: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 18,
  },
  siteGrid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    width: '100%',
  },
  siteCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 22,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  googleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  siteLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
