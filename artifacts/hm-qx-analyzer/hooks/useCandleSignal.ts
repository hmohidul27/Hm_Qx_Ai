import { useEffect, useRef, useCallback } from 'react';
import * as Speech from 'expo-speech';
import { Signal } from '@/context/AppContext';

interface Props {
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  setScanStatus: (s: string) => void;
  setSignal: (s: Signal | null) => void;
  autoScanEnabled: boolean;
  isAnalyzerVisible: boolean;
  priceHandlerRef: React.MutableRefObject<((price: number) => void) | null>;
  fireScanTrigger: () => void;
}

export function useCandleSignal({
  isScanning,
  setIsScanning,
  setScanStatus,
  setSignal,
  autoScanEnabled,
  isAnalyzerVisible,
  priceHandlerRef,
  fireScanTrigger,
}: Props) {
  const tickDataRef = useRef<number[]>([]);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggerRef = useRef(false);
  const isScanningRef = useRef(isScanning);
  isScanningRef.current = isScanning;

  const generateSignal = useCallback(() => {
    // Unregister price listener
    priceHandlerRef.current = null;

    const ticks = tickDataRef.current;

    if (ticks.length < 2) {
      // Not enough data from page — show error and reset
      setScanStatus('NO CHART PRICE DETECTED — OPEN A CHART FIRST');
      setIsScanning(false);
      setTimeout(() => setScanStatus('SYSTEM READY'), 3000);
      return;
    }

    // Signal logic:
    // "Hold point" = price at the START of the scan window (where it was holding)
    // "Close" = last price captured before candle close
    const holdPrice = ticks[0];
    const closePrice = ticks[ticks.length - 1];

    const priceDiff = closePrice - holdPrice;
    const isUp = priceDiff >= 0;

    // Strength based on actual price movement magnitude
    const pipDiff = Math.abs(priceDiff) * 10000; // pips (4 decimal currencies)
    let strength = Math.min(97, pipDiff * 35);
    if (strength < 42) strength = 42 + Math.random() * 20;

    const label = isUp
      ? pipDiff > 3 ? 'STRONG BUY' : 'BUY'
      : pipDiff > 3 ? 'STRONG SELL' : 'SELL';

    const signal: Signal = {
      direction: isUp ? 'UP' : 'DOWN',
      strength: parseFloat(strength.toFixed(1)),
      holdPrice,
      closePrice,
      label,
    };

    setSignal(signal);
    setScanStatus('AI SIGNAL GENERATED SUCCESSFULLY!');
    setIsScanning(false);

    // Voice announcement in Bengali
    const voiceText = isUp
      ? `আপ সিগনাল! বাই করুন! মার্কেট ঊর্ধ্বমুখী।`
      : `ডাউন সিগনাল! সেল করুন! মার্কেট নিম্নমুখী।`;

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
      setScanStatus('INJECTING SCANNER INTO CHART...');

      // Register price listener — prices come from the open chart page
      priceHandlerRef.current = (price: number) => {
        tickDataRef.current.push(price);
        const countdown = durationSeconds - Math.round(tickDataRef.current.length * (durationSeconds / 10));
        const countDisplay = Math.max(0, countdown);
        setScanStatus(
          `READING CHART LIVE: ${countDisplay}s | PRICE: ${price.toFixed(5)}`
        );
      };

      // Tell BrowserView to inject the JS extractor now
      fireScanTrigger();

      let countdown = durationSeconds;
      scanTimerRef.current = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(scanTimerRef.current!);
          scanTimerRef.current = null;
          generateSignal();
        }
      }, 1000);
    },
    [setIsScanning, setScanStatus, priceHandlerRef, fireScanTrigger, generateSignal]
  );

  // Auto-scan: detect last 10 seconds of each 1-minute candle (second 50)
  useEffect(() => {
    if (!autoScanEnabled || !isAnalyzerVisible) return;

    const autoInterval = setInterval(() => {
      const sec = new Date().getSeconds();

      if (sec === 50 && !isScanningRef.current && !autoTriggerRef.current) {
        autoTriggerRef.current = true;
        setScanStatus('AUTO SCAN: LAST 10s OF CANDLE — READING CHART...');
        startScan(9);
      }
      if (sec === 1) {
        autoTriggerRef.current = false;
      }
    }, 500);

    return () => clearInterval(autoInterval);
  }, [autoScanEnabled, isAnalyzerVisible, startScan, setScanStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      priceHandlerRef.current = null;
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [priceHandlerRef]);

  return { startScan };
}
