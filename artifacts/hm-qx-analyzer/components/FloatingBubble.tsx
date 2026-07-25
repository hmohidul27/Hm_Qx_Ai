import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useCandleSignal } from '@/hooks/useCandleSignal';
import * as Haptics from 'expo-haptics';

const { width: W, height: H } = Dimensions.get('window');
const SIZE = 92;

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours() % 12 || 12;
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s} ${now.getHours() >= 12 ? 'PM' : 'AM'}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function FloatingBubble() {
  const colors = useColors();
  const { isScanning, setIsScanning, setScanStatus, setSignal, autoScanEnabled, priceHandlerRef, webViewRef } = useApp();
  const clock = useClock();

  const { startScan } = useCandleSignal({
    isScanning,
    setIsScanning,
    setScanStatus,
    setSignal,
    autoScanEnabled,
    isAnalyzerVisible: true,
    priceHandlerRef,
    webViewRef,
  });

  const pan = useRef(new Animated.ValueXY({ x: W - SIZE - 16, y: 140 })).current;
  const lastPos = useRef({ x: W - SIZE - 16, y: 140 });
  const isDragging = useRef(false);

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isScanning) {
      const a = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.94, duration: 500, useNativeDriver: true }),
        ])
      );
      a.start();
      return () => a.stop();
    }
    Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [isScanning, pulse]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({ x: lastPos.current.x, y: lastPos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) isDragging.current = true;
        pan.setValue({ x: gs.dx, y: gs.dy });
      },
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        const nx = Math.max(0, Math.min(W - SIZE, lastPos.current.x + gs.dx));
        const ny = Math.max(80, Math.min(H - SIZE - 50, lastPos.current.y + gs.dy));
        lastPos.current = { x: nx, y: ny };
        pan.setValue({ x: nx, y: ny });
      },
    })
  ).current;

  function onPress() {
    if (isDragging.current) return;
    if (!isScanning) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startScan(10);
    }
  }

  const borderColor = isScanning ? colors.warning : colors.primary;
  const textColor   = isScanning ? colors.warning : colors.primary;

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          borderColor,
          shadowColor: isScanning ? 'rgba(255,170,0,0.8)' : 'rgba(0,255,255,0.8)',
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: pulse }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableWithoutFeedback onPress={onPress}>
        <View style={styles.inner}>
          <Text style={[styles.top, { color: colors.mutedForeground }]}>Voice AI</Text>
          <Text style={[styles.action, { color: textColor }]}>{isScanning ? 'WAIT' : 'SCAN'}</Text>
          <Text style={styles.clock}>{clock}</Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2.5,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 9999,
  },
  inner: { alignItems: 'center', gap: 2 },
  top:   { fontSize: 8,  fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  action:{ fontSize: 17, fontWeight: '900', letterSpacing: 2 },
  clock: { fontSize: 9, color: '#ffffff', fontFamily: 'monospace', marginTop: 1 },
});
