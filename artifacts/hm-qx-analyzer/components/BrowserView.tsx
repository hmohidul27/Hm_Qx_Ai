import React, { useRef, useState, useEffect, useCallback } from 'react';
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

// ─── JavaScript injected into the chart page ────────────────────────────────
// Hooks WebSocket messages AND scrapes visible price elements.
// Sends prices back via ReactNativeWebView.postMessage({ type: 'price', value })
const PRICE_EXTRACTOR_JS = `
(function() {
  if (window.__hmqxInjected) return;
  window.__hmqxInjected = true;

  function sendPrice(price) {
    if (price > 0 && price < 1000000) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'price', value: price }));
      } catch(e) {}
    }
  }

  // ── 1. Intercept WebSocket traffic (catches Quotex / Binolla live feed) ──
  var _OrigWS = window.WebSocket;
  window.WebSocket = function() {
    var ws = new (Function.prototype.bind.apply(_OrigWS, [null].concat(Array.prototype.slice.call(arguments))))();
    ws.addEventListener('message', function(e) {
      try {
        var raw = typeof e.data === 'string' ? e.data : '';
        // Common JSON price fields used by brokers
        var m = raw.match(/"(?:price|close|bid|ask|rate|c|last|current_price|currentPrice)"\\s*:\\s*"?([0-9]+\\.?[0-9]*)"?/i);
        if (m) { sendPrice(parseFloat(m[1])); return; }
        // Array-based tick: [timestamp, open, high, low, close]
        var arr = raw.match(/\\[\\s*\\d+\\s*,\\s*[0-9.]+\\s*,\\s*[0-9.]+\\s*,\\s*[0-9.]+\\s*,\\s*([0-9.]+)/);
        if (arr) { sendPrice(parseFloat(arr[1])); return; }
        // Quotex-style: {"asset":"EURUSD","time":...,"price":1.08450}
        var parsed = null;
        try { parsed = JSON.parse(raw); } catch(e) {}
        if (parsed) {
          var p = parsed.price || parsed.close || parsed.bid || parsed.ask ||
                  parsed.c || parsed.last || parsed.rate || parsed.currentPrice;
          if (p) sendPrice(parseFloat(p));
        }
      } catch(err) {}
    });
    return ws;
  };
  try { window.WebSocket.prototype = _OrigWS.prototype; } catch(e) {}

  // ── 2. DOM scraper fallback (runs every 1.2 s) ───────────────────────────
  function domScrape() {
    // Selectors typical of Quotex, Binolla, and TradingView widgets
    var selectors = [
      '.current-price', '.asset-price', '.price-value', '.chart-price',
      '[class*="CurrentPrice"]', '[class*="current-price"]',
      '[class*="assetPrice"]', '[class*="price_value"]',
      '.js-symbol-last', '.tv-symbol-price-quote__value',
      '[data-field="last_price"]', '[data-role="price"]',
      'span[class*="price"]', 'div[class*="price"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var txt = el.textContent.replace(/,/g, '.').trim();
        var m = txt.match(/([0-9]{1,6}\\.[0-9]{2,8})/);
        if (m) { sendPrice(parseFloat(m[1])); return; }
      }
    }
    // Last resort: scan all leaf text nodes for price-like numbers
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var t = node.textContent.trim();
      if (t.length < 12) {
        var match = t.match(/^([0-9]{1,5}\\.[0-9]{4,8})$/);
        if (match) { sendPrice(parseFloat(match[1])); return; }
      }
    }
  }
  setInterval(domScrape, 1200);
  domScrape();
  true;
})();
`;

// ─── URL helpers ─────────────────────────────────────────────────────────────
function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) return '';
  if (t.toLowerCase().includes('google.com')) return 'https://www.google.com/webhp?igu=1';
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

// ─────────────────────────────────────────────────────────────────────────────
export default function BrowserView() {
  const colors = useColors();
  const { setCurrentUrl, setView, reportPrice, scanTrigger } = useApp();
  const webViewRef = useRef<WebView>(null);
  const [addressText, setAddressText] = useState('');
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  // Re-inject price extractor whenever a scan is triggered
  useEffect(() => {
    if (scanTrigger > 0 && showWebView && webViewRef.current) {
      webViewRef.current.injectJavaScript(PRICE_EXTRACTOR_JS);
    }
  }, [scanTrigger, showWebView]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'price' && typeof msg.value === 'number') {
          reportPrice(msg.value);
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    [reportPrice]
  );

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
    if (addressText.trim()) loadUrl(addressText);
  }

  return (
    <View style={styles.container}>
      {/* ── Browser Control Bar ── */}
      <View style={[styles.browserBar, { backgroundColor: '#0c0613', borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.ctrlBtn, { borderColor: colors.border }]} onPress={goHome}>
          <Ionicons name="home-outline" size={15} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, { borderColor: colors.border }]}
          onPress={() => setView('dashboard')}
        >
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

      {/* ── Viewport ── */}
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
            onMessage={handleMessage}
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

// ─── Home Screen ─────────────────────────────────────────────────────────────
function HomeScreen({
  onLoadUrl,
  colors,
}: {
  onLoadUrl: (url: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[homeStyles.container, { backgroundColor: '#070e14' }]}>
      <Text style={[homeStyles.heading, { color: colors.primary }]}>Trading Gateway</Text>
      <Text style={[homeStyles.sub, { color: colors.mutedForeground }]}>
        Select a platform — the AI will analyze its live chart
      </Text>

      <View style={homeStyles.siteGrid}>
        {HOME_SITES.map((site) => (
          <TouchableOpacity
            key={site.url}
            style={[
              homeStyles.siteCard,
              { borderColor: `${site.color}44`, backgroundColor: `${site.color}0D` },
            ]}
            onPress={() => onLoadUrl(site.url)}
            activeOpacity={0.8}
          >
            <Ionicons name={site.icon} size={30} color={site.color} />
            <Text style={[homeStyles.siteLabel, { color: '#fff' }]}>{site.label}</Text>
            <Text style={[homeStyles.siteSub, { color: site.color }]}>Tap to open</Text>
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
          Open Quotex or Binolla, then press the SCAN bubble to analyze the live chart
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
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
  goBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  viewport: { flex: 1 },
  webView: { flex: 1 },
});

const homeStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  sub: { fontSize: 12, textAlign: 'center', marginBottom: 28, lineHeight: 18 },
  siteGrid: { flexDirection: 'row', gap: 14, marginBottom: 14, width: '100%' },
  siteCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  siteLabel: { fontSize: 14, fontWeight: '700' },
  siteSub: { fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  googleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintText: { fontSize: 11, flex: 1, lineHeight: 16 },
});
