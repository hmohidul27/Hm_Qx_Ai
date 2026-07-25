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
}

export function useCandleSignal({
  isScanning,
  setIsScanning,
  setScanStatus,
  setSignal,
  autoScanEnabled,
  isAnalyzerVisible,
  priceHandlerRef,
}: Props) {
  const tickDataRef = useRef<number[]>([]);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTriggerRef = useRef(false);
  const isScanningRef = useRef(isScanning);
  isScanningRef.current = isScanning;

  const generateSignal = useCallback(() => {
    // Stop collecting prices
    priceHandlerRef.current = null;

    const ticks = tickDataRef.current;

    if (ticks.length < 2) {
      setScanStatus('NO PRICE DATA — OPEN A CHART AND TRY AGAIN');
      setIsScanning(false);
      setTimeout(() => setScanStatus('SYSTEM READY'), 3500);
      return;
    }

    // Core logic:
    // holdPrice = price at scan start (where it was holding)
    // closePrice = last price when candle closes
    const holdPrice = ticks[0];
    const closePrice = ticks[ticks.length - 1];
    const priceDiff = closePrice - holdPrice;
    const isUp = priceDiff >= 0;

    // Strength in pips (4-decimal pairs)
    const pipDiff = Math.abs(priceDiff) * 10000;
    let strength = Math.min(97, pipDiff * 40);
    if (strength < 44) strength = 44 + Math.random() * 22;

    const label = isUp
      ? pipDiff > 2.5 ? 'STRONG BUY' : 'BUY'
      : pipDiff > 2.5 ? 'STRONG SELL' : 'SELL';

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

    // Voice announcement in Bengali
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
      setScanStatus('READING CHART LIVE...');

      let countdown = durationSeconds;
      let lastDisplayedPrice = 0;

      // Register price listener — prices come from the open chart via BrowserView
      priceHandlerRef.current = (price: number) => {
        tickDataRef.current.push(price);
        if (price !== lastDisplayedPrice) {
          lastDisplayedPrice = price;
          setScanStatus(`READING CHART: ${countdown}s LEFT | ${price.toFixed(5)}`);
        }
      };

      scanTimerRef.current = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(scanTimerRef.current!);
          scanTimerRef.current = null;
          generateSignal();
        }
      }, 1000);
    },
    [setIsScanning, setScanStatus, priceHandlerRef, generateSignal]
  );

  // Auto-scan: last 10 seconds of every 1-minute candle (second = 50)
  useEffect(() => {
    if (!autoScanEnabled || !isAnalyzerVisible) return;
    const id = setInterval(() => {
      const sec = new Date().getSeconds();
      if (sec === 50 && !isScanningRef.current && !autoTriggerRef.current) {
        autoTriggerRef.current = true;
        setScanStatus('AUTO: LAST 10s OF CANDLE — READING CHART...');
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
    };
  }, [priceHandlerRef]);

  return { startScan };
}
