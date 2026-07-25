import React from 'react';
import { Tabs } from 'expo-router';

// Single-screen app — no visible tab bar
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'HM QX Analyzer' }} />
    </Tabs>
  );
}
