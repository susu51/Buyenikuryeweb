import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Login' }} />
      <Stack.Screen name="courier" options={{ title: 'Kurye Dashboard' }} />
      <Stack.Screen name="business" options={{ title: 'İşletme Dashboard' }} />
      <Stack.Screen name="customer" options={{ title: 'Müşteri Dashboard' }} />
      <Stack.Screen name="map" />
    </Stack>
  );
}