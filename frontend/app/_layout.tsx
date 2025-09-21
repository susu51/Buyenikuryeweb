import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="courier" />
      <Stack.Screen name="business" />
      <Stack.Screen name="customer" />
    </Stack>
  );
}