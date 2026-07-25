import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function Dashboard() {
  const { setView } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  function startAnalyzer() {
    setView('analyzer');
  }

  function comingSoon() {
    // placeholder for future features
  }

  return (
    <LinearGradient
      colors={['#1a0a2e', '#080510', '#0a050d']}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerGlow} />
          <Text style={[styles.title, { color: colors.primary }]}>HM QX</Text>
          <Text style={[styles.subtitle, { color: colors.primary }]}>ANALYZER</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            AI-Powered Candle Signal Engine
          </Text>
        </View>

        {/* Main Cards Row 1 */}
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.card, styles.cardPrimary, { borderColor: colors.border }]}
            onPress={startAnalyzer}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(0,255,255,0.12)', 'rgba(0,255,255,0.04)']}
              style={styles.cardGradient}
            >
              <View style={[styles.iconCircle, { borderColor: colors.primary }]}>
                <Ionicons name="bar-chart" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.primary }]}>
                Candle{'\n'}Reaction AI
              </Text>
              <View style={[styles.activeBadge, { backgroundColor: 'rgba(0,255,102,0.15)' }]}>
                <View style={styles.activeDot} />
                <Text style={[styles.activeBadgeText, { color: colors.success }]}>ACTIVE</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { borderColor: 'rgba(255,170,0,0.2)' }]}
            onPress={comingSoon}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={['rgba(255,170,0,0.08)', 'rgba(255,170,0,0.02)']}
              style={styles.cardGradient}
            >
              <View style={[styles.iconCircle, { borderColor: 'rgba(255,170,0,0.4)' }]}>
                <MaterialCommunityIcons name="infinity" size={28} color={colors.warning} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.warning }]}>Auto AI</Text>
              <View style={[styles.activeBadge, { backgroundColor: 'rgba(255,170,0,0.1)' }]}>
                <Text style={[styles.activeBadgeText, { color: colors.warning }]}>COMING SOON</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Main Cards Row 2 */}
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.card, { borderColor: 'rgba(100,180,255,0.2)' }]}
            onPress={comingSoon}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={['rgba(100,180,255,0.08)', 'rgba(100,180,255,0.02)']}
              style={styles.cardGradient}
            >
              <View style={[styles.iconCircle, { borderColor: 'rgba(100,180,255,0.4)' }]}>
                <Ionicons name="trending-up" size={28} color="#64b4ff" />
              </View>
              <Text style={[styles.cardTitle, { color: '#64b4ff' }]}>Forex AI</Text>
              <View style={[styles.activeBadge, { backgroundColor: 'rgba(100,180,255,0.1)' }]}>
                <Text style={[styles.activeBadgeText, { color: '#64b4ff' }]}>COMING SOON</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { borderColor: 'rgba(180,100,255,0.2)' }]}
            onPress={comingSoon}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={['rgba(180,100,255,0.08)', 'rgba(180,100,255,0.02)']}
              style={styles.cardGradient}
            >
              <View style={[styles.iconCircle, { borderColor: 'rgba(180,100,255,0.4)' }]}>
                <FontAwesome5 name="microphone-alt" size={24} color="#b464ff" />
              </View>
              <Text style={[styles.cardTitle, { color: '#b464ff' }]}>AI Assistance</Text>
              <View style={[styles.activeBadge, { backgroundColor: 'rgba(180,100,255,0.1)' }]}>
                <Text style={[styles.activeBadgeText, { color: '#b464ff' }]}>COMING SOON</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Info strip */}
        <View style={[styles.infoStrip, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Auto-scan triggers at the last 10s of each 1-min candle
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 32, position: 'relative' },
  headerGlow: {
    position: 'absolute',
    top: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,255,255,0.06)',
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 8,
    textShadowColor: 'rgba(0,255,255,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 10,
    marginTop: -4,
    textShadowColor: 'rgba(0,255,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tagline: { fontSize: 11, letterSpacing: 2, marginTop: 10 },
  row: { flexDirection: 'row', gap: 14, width: '100%', marginBottom: 14 },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    minHeight: 140,
  },
  cardPrimary: {},
  cardGradient: {
    flex: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ff66',
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginTop: 4,
  },
  infoText: { fontSize: 11, flex: 1, lineHeight: 16 },
});
