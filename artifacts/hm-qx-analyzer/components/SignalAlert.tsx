import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Signal } from '@/context/AppContext';

interface Props {
  signal: Signal;
}

const { width: SCREEN_W } = Dimensions.get('window');

export default function SignalAlert({ signal }: Props) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const isUp = signal.direction === 'UP';
  const dirColor = isUp ? colors.success : colors.destructive;
  const bgGradient: readonly [string, string] = isUp
    ? ['rgba(0,255,102,0.08)', 'rgba(0,255,102,0.02)']
    : ['rgba(255,51,68,0.08)', 'rgba(255,51,68,0.02)'];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity, transform: [{ scale }] },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['rgba(5,15,20,0.97)', 'rgba(10,5,20,0.97)']}
        style={[styles.container, { borderColor: dirColor }]}
      >
        <LinearGradient colors={bgGradient} style={styles.innerGradient}>
          {/* Header */}
          <Text style={[styles.alertTitle, { color: colors.mutedForeground }]}>
            AI SIGNAL ALERT
          </Text>

          {/* Direction Icon */}
          <View style={styles.iconRow}>
            <Ionicons
              name={isUp ? 'arrow-up-circle' : 'arrow-down-circle'}
              size={52}
              color={dirColor}
            />
          </View>

          {/* Direction text */}
          <Text style={[styles.direction, { color: dirColor }]}>
            {isUp ? 'UP' : 'DOWN'}
          </Text>
          <Text style={[styles.label, { color: dirColor }]}>{signal.label}</Text>

          {/* Info box */}
          <View style={[styles.infoBox, { borderColor: `${dirColor}33`, backgroundColor: 'rgba(255,255,255,0.04)' }]}>
            <InfoRow label="Hold Price" value={`$${signal.holdPrice.toFixed(5)}`} color={colors.foreground} muted={colors.mutedForeground} />
            <InfoRow label="Close Price" value={`$${signal.closePrice.toFixed(5)}`} color={dirColor} muted={colors.mutedForeground} />
            <InfoRow label="Trend Strength" value={`${signal.strength}%`} color={colors.primary} muted={colors.mutedForeground} />
            <InfoRow label="Signal Type" value="1-Min Candle" color={colors.foreground} muted={colors.mutedForeground} />
          </View>

          {/* Closing countdown bar */}
          <ProgressBar color={dirColor} durationMs={7500} />
        </LinearGradient>
      </LinearGradient>
    </Animated.View>
  );
}

function InfoRow({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: muted }]}>{label}</Text>
      <Text style={[infoStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 3 },
  label: { fontSize: 11, letterSpacing: 0.5 },
  value: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});

function ProgressBar({ color, durationMs }: { color: string; durationMs: number }) {
  const width = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: 0, duration: durationMs, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={pbStyles.track}>
      <Animated.View style={[pbStyles.fill, { backgroundColor: color, flex: width }]} />
    </View>
  );
}

const pbStyles = StyleSheet.create({
  track: { width: '100%', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 14 },
  fill: { height: '100%', borderRadius: 2 },
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: '30%',
    left: SCREEN_W * 0.06,
    width: SCREEN_W * 0.88,
    zIndex: 99999,
  },
  container: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  innerGradient: {
    padding: 24,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  iconRow: { marginBottom: 4 },
  direction: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  infoBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
});
