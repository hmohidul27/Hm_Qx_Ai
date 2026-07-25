import React, { useRef, useState, useCallback } from 'react';
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

// ─── Price extractor — runs BEFORE page content loads ─────────────────────
// Hooks WebSocket, XHR, fetch AND DOM to capture prices from any broker page.
// Sends: { type: 'price', value: number }
const PRICE_EXTRACTOR_JS = `
(function() {
  if (window.__hmqx) return true;
  window.__hmqx = true;

  function postPrice(p) {
    p = parseFloat(p);
    if (isNaN(p) || p <= 0 || p > 1000000) return;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'price',value:p})); } catch(e){}
  }

  function scanJson(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 4) return;
    var keys = ['price','close','bid','ask','rate','c','last','currentPrice','current_price','close_price','closePrice','p','ltp'];
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] !== undefined) { postPrice(obj[keys[i]]); return; }
    }
    var vals = Object.values(obj);
    for (var j = 0; j < vals.length; j++) scanJson(vals[j], depth + 1);
  }

  function parseMsg(raw) {
    if (!raw || typeof raw !== 'string') return;
    // Try full JSON parse first
    try { scanJson(JSON.parse(raw), 0); return; } catch(e) {}
    // Regex: "price":1.08450  or  "c":"1.08450"
    var m = raw.match(/"(?:price|close|bid|ask|rate|c|last|ltp|currentPrice|current_price)"\\s*:\\s*"?([0-9]+\\.?[0-9]+)"?/i);
    if (m) { postPrice(m[1]); return; }
    // OHLC arrays: [timestamp, open, high, low, close, ...]
    var a = raw.match(/\\[\\s*[0-9]{9,}\\s*,\\s*[0-9.]+\\s*,\\s*[0-9.]+\\s*,\\s*[0-9.]+\\s*,\\s*([0-9.]+)/);
    if (a) { postPrice(a[1]); }
  }

  // ── 1. WebSocket interception (catches broker live feed) ─────────────────
  var _WS = window.WebSocket;
  function HookedWS(url, proto) {
    var ws = proto ? new _WS(url, proto) : new _WS(url);
    ws.addEventListener('message', function(e) { parseMsg(e.data); });
    return ws;
  }
  HookedWS.prototype = _WS.prototype;
  HookedWS.CONNECTING = _WS.CONNECTING;
  HookedWS.OPEN = _WS.OPEN;
  HookedWS.CLOSING = _WS.CLOSING;
  HookedWS.CLOSED = _WS.CLOSED;
  window.WebSocket = HookedWS;

  // ── 2. XHR interception ──────────────────────────────────────────────────
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function() { this.__url = arguments[1]; return _open.apply(this,arguments); };
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try { parseMsg(this.responseText); } catch(e) {}
    });
    return _send.apply(this, arguments);
  };

  // ── 3. fetch() interception ───────────────────────────────────────────────
  var _fetch = window.fetch;
  window.fetch = function() {
    return _fetch.apply(this, arguments).then(function(resp) {
      var clone = resp.clone();
      clone.text().then(parseMsg).catch(function(){});
      return resp;
    });
  };

  // ── 4. DOM scanner — finds visible price text ─────────────────────────────
  function domScan() {
    try {
      // Specific broker selectors first
      var sels = [
        '.current-price','[class*="current-price"]','[class*="CurrentPrice"]',
        '.asset-price','[class*="asset-price"]','[class*="assetPrice"]',
        '.price-value','[class*="price-value"]','[class*="priceValue"]',
        '.chart-price','[class*="chart-price"]',
        '.rate','[class*="rateValue"]',
        '.js-symbol-last','.tv-symbol-price-quote__value',
        '[data-field="last_price"]','[data-role="price"]',
        'span[class*="price"]','div[class*="price"]','p[class*="price"]'
      ];
      for (var i = 0; i < sels.length; i++) {
        var el = document.querySelector(sels[i]);
        if (el && el.offsetParent !== null) {
          var txt = el.textContent.replace(/,/g,'.').trim();
          var m = txt.match(/([0-9]{1,6}\\.[0-9]{2,8})/);
          if (m) { postPrice(m[1]); return; }
        }
      }
      // Fallback: scan leaf text nodes for price-like numbers
      var walker = document.createTreeWalker(document.body, 4, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var t = (node.textContent || '').trim();
        if (t.length >= 5 && t.length <= 12) {
          var match = t.match(/^([0-9]{1,5}\\.[0-9]{3,8})$/);
          if (match) { postPrice(match[1]); return; }
        }
      }
    } catch(e) {}
  }

  document.addEventListener('DOMContentLoaded', function() { setInterval(domScan, 1200); });
  setTimeout(function() { setInterval(domScan, 1200); }, 3000);

  true;
})();
`;

// ─── URL helpers ──────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
export default function BrowserView() {
  const colors = useColors();
  const { setCurrentUrl, setView, reportPrice } = useApp();
  const webViewRef = useRef<WebView>(null);
  const [addressText, setAddressText] = useState('');
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  // All prices from the page flow here continuously
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'price' && typeof msg.value === 'number' && msg.value > 0) {
          reportPrice(msg.value);
        }
      } catch {
        // ignore non-JSON messages from the page
      }
    },
    [reportPrice]
  );

  function loadUrl(url: string) {
    const norm = normalizeUrl(url);
    if (!norm) return;
    setWebViewUrl(norm);
    setAddressText(norm.includes('webhp') ? 'https://www.google.com' : norm);
    setShowWebView(true);
    setCurrentUrl(norm);
  }

  function goHome() {
    setShowWebView(false);
    setWebViewUrl('');
    setAddressText('');
  }

  function reload() { webViewRef.current?.reload(); }
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
            ref={webViewRef}
            source={{ uri: webViewUrl }}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // Inject BEFORE page JS runs — catches WebSocket from the very start
            injectedJavaScriptBeforeContentLoaded={PRICE_EXTRACTOR_JS}
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
