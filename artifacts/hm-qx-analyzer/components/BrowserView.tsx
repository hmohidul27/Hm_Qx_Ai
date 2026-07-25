import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

// ─── Injected BEFORE page content loads ───────────────────────────────────
// Hooks WebSocket so live price ticks are captured from the very first frame.
const PRELOAD_JS = `
(function() {
  if (window.__hmqxWS) return true;
  window.__hmqxWS = true;

  function postPrice(p) {
    p = parseFloat(p);
    if (isNaN(p) || p <= 0 || p > 1000000) return;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'price',value:p})); } catch(e){}
  }

  function tryExtract(raw) {
    if (!raw || typeof raw !== 'string') return;
    // Socket.io wrapped JSON: 42["event",{...}]
    var sio = raw.match(/^\\d+\\[".+?",({.+})\\]$/);
    if (sio) { raw = sio[1]; }
    try {
      var d = JSON.parse(raw);
      var keys = ['price','close','bid','ask','c','last','rate','ltp','currentPrice','current_price','close_price'];
      for (var i=0;i<keys.length;i++){
        if (d[keys[i]] !== undefined) { postPrice(d[keys[i]]); return; }
      }
      // nested: {data:{price:...}}
      if (d.data) for (var i=0;i<keys.length;i++){
        if (d.data[keys[i]] !== undefined) { postPrice(d.data[keys[i]]); return; }
      }
    } catch(e) {}
    // Plain regex fallback
    var m = raw.match(/"(?:price|close|bid|ask|c|last|rate|ltp)":\\s*"?([0-9]+\\.?[0-9]+)"?/i);
    if (m) postPrice(m[1]);
  }

  // WebSocket hook
  var _WS = window.WebSocket;
  window.WebSocket = function(url, proto) {
    var ws = proto ? new _WS(url, proto) : new _WS(url);
    ws.addEventListener('message', function(e) {
      if (typeof e.data === 'string') tryExtract(e.data);
    });
    return ws;
  };
  try { window.WebSocket.prototype = _WS.prototype; } catch(e) {}

  true;
})();
`;

// ─── URL helpers ──────────────────────────────────────────────────────────
function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return '';
  if (t.toLowerCase().includes('quotex.com') || t.toLowerCase().includes('qxbroker.com'))
    return 'https://market-qx.trade';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

const HOME_SITES = [
  { label: 'Quotex', url: 'https://market-qx.trade', color: '#00ff66', icon: 'trending-up' as const },
  { label: 'Binolla', url: 'https://binolla.com', color: '#ffaa00', icon: 'logo-bitcoin' as const },
];

// ─────────────────────────────────────────────────────────────────────────
export default function BrowserView() {
  const colors = useColors();
  const { setCurrentUrl, setView, reportPrice, webViewRef } = useApp();
  const [addressText, setAddressText] = useState('');
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'price' && typeof msg.value === 'number' && msg.value > 0) {
          reportPrice(msg.value);
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    [reportPrice]
  );

  function loadUrl(url: string) {
    const norm = normalizeUrl(url);
    if (!norm) return;
    setWebViewUrl(norm);
    setAddressText(norm);
    setShowWebView(true);
    setCurrentUrl(norm);
  }

  function goHome() {
    setShowWebView(false);
    setWebViewUrl('');
    setAddressText('');
  }

  function reload() { (webViewRef.current as any)?.reload(); }
  function handleSubmit() { if (addressText.trim()) loadUrl(addressText); }

  return (
    <View style={styles.container}>
      {/* Browser bar */}
      <View style={[styles.browserBar, { backgroundColor: '#0c0613', borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border }]} onPress={goHome}>
          <Ionicons name="home-outline" size={15} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border }]} onPress={() => setView('dashboard')}>
          <Ionicons name="grid-outline" size={15} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border }]} onPress={reload}>
          <Ionicons name="refresh" size={15} color={colors.primary} />
        </TouchableOpacity>

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
            ref={webViewRef as any}
            source={{ uri: webViewUrl }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            injectedJavaScriptBeforeContentLoaded={PRELOAD_JS}
            onMessage={handleMessage}
            onNavigationStateChange={(state) => {
              if (state.url) {
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

// ─── Home screen ──────────────────────────────────────────────────────────
function HomeScreen({ onLoadUrl, colors }: { onLoadUrl: (url: string) => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[homeStyles.container, { backgroundColor: '#070e14' }]}>
      <Text style={[homeStyles.heading, { color: colors.primary }]}>Trading Gateway</Text>
      <Text style={[homeStyles.sub, { color: colors.mutedForeground }]}>
        Open Quotex or Binolla — the AI will read the live chart directly
      </Text>
      <View style={homeStyles.siteGrid}>
        {HOME_SITES.map((s) => (
          <TouchableOpacity
            key={s.url}
            style={[homeStyles.siteCard, { borderColor: `${s.color}44`, backgroundColor: `${s.color}0D` }]}
            onPress={() => onLoadUrl(s.url)}
            activeOpacity={0.8}
          >
            <Ionicons name={s.icon} size={30} color={s.color} />
            <Text style={[homeStyles.siteLabel, { color: '#fff' }]}>{s.label}</Text>
            <Text style={[homeStyles.siteSub, { color: s.color }]}>Tap to open</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[homeStyles.googleCard, { borderColor: colors.border, backgroundColor: colors.muted }]}
        onPress={() => onLoadUrl('https://www.google.com')}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-google" size={22} color={colors.primary} />
        <Text style={[homeStyles.siteLabel, { color: '#fff' }]}>Google Search</Text>
      </TouchableOpacity>
      <View style={[homeStyles.hint, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
        <Text style={[homeStyles.hintText, { color: colors.mutedForeground }]}>
          Open Quotex or Binolla chart first, then press SCAN
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  browserBar: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: 1 },
  ctrlBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  addressWrapper: { flex: 1, height: 32, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  addressInput: { flex: 1, fontSize: 11, paddingHorizontal: 6, paddingVertical: 0, height: '100%' },
  goBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  viewport: { flex: 1 },
  webView: { flex: 1 },
});

const homeStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  sub: { fontSize: 12, textAlign: 'center', marginBottom: 28, lineHeight: 18 },
  siteGrid: { flexDirection: 'row', gap: 14, marginBottom: 14, width: '100%' },
  siteCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 24, borderRadius: 16, borderWidth: 1.5 },
  siteLabel: { fontSize: 14, fontWeight: '700' },
  siteSub: { fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  googleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%', padding: 12, borderRadius: 12, borderWidth: 1 },
  hintText: { fontSize: 11, flex: 1, lineHeight: 16 },
});
