import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  message: string;
  isScanning: boolean;
}

export default function ScanStatusBar({ message, isScanning }: Props) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isScanning) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      opacity.setValue(1);
    }
  }, [isScanning, opacity]);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isScanning
            ? 'rgba(0, 255, 255, 0.18)'
            : 'rgba(0,0,0,0.6)',
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Animated.Text style={[styles.text, { color: colors.primary, opacity }]}>
        {message}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
