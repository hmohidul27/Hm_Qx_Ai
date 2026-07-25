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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BUBBLE_SIZE = 92;

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      const h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      setTime(`${h12}:${m}:${s} ${ampm}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function FloatingBubble() {
  const colors = useColors();
  const {
    isScanning,
    setIsScanning,
    setScanStatus,
    setSignal,
    autoScanEnabled,
    priceHandlerRef,
    fireScanTrigger,
  } = useApp();
  const clock = useClock();

  const { startScan } = useCandleSignal({
    isScanning,
    setIsScanning,
    setScanStatus,
    setSignal,
    autoScanEnabled,
    isAnalyzerVisible: true,
    priceHandlerRef,
    fireScanTrigger,
  });

  // ── Animated position ────────────────────────────────────────────────────
  const pan = useRef(
    new Animated.ValueXY({ x: SCREEN_W - BUBBLE_SIZE - 16, y: 140 })
  ).current;
  const isDragging = useRef(false);
  const lastPos = useRef({ x: SCREEN_W - BUBBLE_SIZE - 16, y: 140 });

  // ── Pulse while scanning ─────────────────────────────────────────────────
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isScanning) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.95, duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isScanning, pulse]);

  // ── Drag ─────────────────────────────────────────────────────────────────
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
        if (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4) isDragging.current = true;
        pan.setValue({ x: gs.dx, y: gs.dy });
      },
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        const newX = Math.max(0, Math.min(SCREEN_W - BUBBLE_SIZE, lastPos.current.x + gs.dx));
        const newY = Math.max(80, Math.min(SCREEN_H - BUBBLE_SIZE - 40, lastPos.current.y + gs.dy));
        lastPos.current = { x: newX, y: newY };
        pan.setValue({ x: newX, y: newY });
      },
    })
  ).current;

  function handlePress() {
    if (isDragging.current) return;
    if (!isScanning) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startScan(10);
    }
  }

  const borderColor = isScanning ? colors.warning : colors.primary;
  const actionText = isScanning ? 'WAIT' : 'SCAN';
  const actionColor = isScanning ? colors.warning : colors.primary;

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          borderColor,
          shadowColor: isScanning ? 'rgba(255,170,0,0.7)' : 'rgba(0,255,255,0.7)',
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: pulse },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.inner}>
          <Text style={[styles.labelTop, { color: colors.mutedForeground }]}>Voice AI</Text>
          <Text style={[styles.action, { color: actionColor }]}>{actionText}</Text>
          <Text style={styles.clock}>{clock}</Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2.5,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 20,
    zIndex: 9999,
  },
  inner: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  labelTop: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  action: { fontSize: 16, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  clock: { fontSize: 9, color: '#ffffff', fontFamily: 'monospace', marginTop: 2 },
});
