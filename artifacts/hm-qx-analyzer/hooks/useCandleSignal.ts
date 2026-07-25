import { useEffect, useRef, useCallback } from 'react';
import * as Speech from 'expo-speech';
import { Signal } from '@/context/AppContext';

// Injected on-demand during scan — broad DOM scan as supplementary fallback
const DOM_SCAN_JS = `
(function() {
  function post(p) {
    p = parseFloat(String(p).replace(/,/g,'.'));
    if (isNaN(p) || p <= 0 || p > 9999999) return;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'price',value:p})); } catch(e){}
  }
  var sels = [
    '.current-price','[class*="current-price"]','[class*="currentPrice"]',
    '.asset-price','[class*="asset-price"]','[class*="assetPrice"]',
    '.js-price','.js-rate','.trade-price','.deal-price',
    '[class*="price-value"]','[class*="priceValue"]',
    '[class*="rate-value"]','[class*="rateValue"]',
    '.value','.price','.rate',
    '[data-field="last_price"]','[data-role="price"]',
    '.tv-symbol-price-quote__value',
    'span[class*="price"]','div[class*="price"]',
    'span[class*="rate"]','div[class*="rate"]'
  ];
  for (var i=0;i<sels.length;i++){
    var els=document.querySelectorAll(sels[i]);
    for(var j=0;j<els.length;j++){
      var el=els[j];
      if(el.offsetParent!==null){
        var txt=(el.textContent||'').replace(/,/g,'.').trim();
        var m=txt.match(/([0-9]{1,7}\\.[0-9]{2,6})/);
        if(m){post(m[1]);return;}
      }
    }
  }
  // Leaf element fallback
  var all=document.querySelectorAll('span,div,p,td,li,label');
  for(var k=0;k<all.length;k++){
    var el=all[k];
    if(el.children.length===0&&el.offsetParent!==null){
      var t=(el.textContent||'').replace(/,/g,'.').trim();
      if(t.length>=4&&t.length<=14){
        var match=t.match(/^([0-9]{1,7}\\.[0-9]{2,6})$/);
        if(match){post(match[1]);return;}
      }
    }
  }
  true;
})();
`;

interface Props {
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  setScanStatus: (s: string) => void;
  setSignal: (s: Signal | null) => void;
  autoScanEnabled: boolean;
  isAnalyzerVisible: boolean;
  priceHandlerRef: React.MutableRefObject<((price: number) => void) | null>;
  webViewRef: React.MutableRefObject<any>;
}

export function useCandleSignal({
  isScanning,
  setIsScanning,
  setScanStatus,
  setSignal,
  autoScanEnabled,
  isAnalyzerVisible,
  priceHandlerRef,
  webViewRef,
}: Props) {
  const tickDataRef   = useRef<number[]>([]);
  const scanTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const domPollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggerRef = useRef(false);
  const isScanningRef  = useRef(isScanning);
  isScanningRef.current = isScanning;

  const generateSignal = useCallback(() => {
    priceHandlerRef.current = null;
    if (domPollRef.current) { clearInterval(domPollRef.current); domPollRef.current = null; }

    const ticks = tickDataRef.current;

    if (ticks.length < 2) {
      // Not enough data — give a helpful message
      setScanStatus('NO PRICE DATA — RELOAD THE CHART PAGE AND TRY AGAIN');
      setIsScanning(false);
      setTimeout(() => setScanStatus('SYSTEM READY'), 5000);
      return;
    }

    const holdPrice  = ticks[0];
    const closePrice = ticks[ticks.length - 1];
    const priceDiff  = closePrice - holdPrice;
    const isUp       = priceDiff >= 0;

    // Use 10000 for forex (4-decimal), 1 for index-like (USD/IDR range 17000+)
    const multiplier = holdPrice > 100 ? 1 : 10000;
    const pipDiff    = Math.abs(priceDiff) * multiplier;

    let strength = Math.min(97, pipDiff * 40);
    if (strength < 44) strength = 44 + Math.random() * 22;

    const label = isUp
      ? (pipDiff > 3 ? 'STRONG BUY' : 'BUY')
      : (pipDiff > 3 ? 'STRONG SELL' : 'SELL');

    const signal: Signal = {
      direction: isUp ? 'UP' : 'DOWN',
      strength: parseFloat(strength.toFixed(1)),
      holdPrice,
      closePrice,
      label,
    };

    setSignal(signal);
    setScanStatus('AI SIGNAL GENERATED!');
    setIsScanning(false);

    const voiceText = isUp
      ? 'আপ সিগনাল! বাই করুন! মার্কেট ঊর্ধ্বমুখী।'
      : 'ডাউন সিগনাল! সেল করুন! মার্কেট নিম্নমুখী।';
    Speech.speak(voiceText, { language: 'bn-BD', rate: 0.85, pitch: 1.1 });

    setTimeout(() => {
      setSignal(null);
      setScanStatus('SYSTEM READY FOR NEXT SCAN');
    }, 7500);
  }, [priceHandlerRef, setIsScanning, setScanStatus, setSignal]);

  const startScan = useCallback(
    (durationSeconds = 10) => {
      if (isScanningRef.current) return;

      tickDataRef.current = [];
      setIsScanning(true);
      setScanStatus('CONNECTING TO CHART...');

      let countdown = durationSeconds;
      let lastPrice = 0;

      // Register handler — prices from canvas interception + WebSocket arrive here
      priceHandlerRef.current = (price: number) => {
        tickDataRef.current.push(price);
        if (price !== lastPrice) {
          lastPrice = price;
          setScanStatus(`READING: ${countdown}s | ${price.toFixed(price > 100 ? 2 : 5)}`);
        }
      };

      // DOM poll as additional fallback (in case canvas hook or WS aren't sending)
      domPollRef.current = setInterval(() => {
        try { webViewRef.current?.injectJavaScript(DOM_SCAN_JS); } catch (_) {}
      }, 700);

      // Countdown
      scanTimerRef.current = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(scanTimerRef.current!);
          scanTimerRef.current = null;
          generateSignal();
        }
      }, 1000);
    },
    [setIsScanning, setScanStatus, priceHandlerRef, webViewRef, generateSignal]
  );

  // Auto-scan: last 10 seconds of every 1-minute candle (fires at second = 50)
  useEffect(() => {
    if (!autoScanEnabled || !isAnalyzerVisible) return;
    const id = setInterval(() => {
      const sec = new Date().getSeconds();
      if (sec === 50 && !isScanningRef.current && !autoTriggerRef.current) {
        autoTriggerRef.current = true;
        setScanStatus('AUTO: LAST 10s — READING CHART...');
        startScan(9);
      }
      if (sec === 1) autoTriggerRef.current = false;
    }, 500);
    return () => clearInterval(id);
  }, [autoScanEnabled, isAnalyzerVisible, startScan, setScanStatus]);

  useEffect(() => {
    return () => {
      priceHandlerRef.current = null;
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      if (domPollRef.current) clearInterval(domPollRef.current);
    };
  }, [priceHandlerRef]);

  return { startScan };
}
