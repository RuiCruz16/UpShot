import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import * as alarmEngine from '@/src/engine/alarmEngine';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    alarmEngine.init();

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as
        | { type?: string; alarmId?: string }
        | undefined;
      if (data?.type === 'alarm') {
        router.push({
          pathname: '/verify' as any,
          params: data.alarmId ? { alarmId: data.alarmId } : undefined,
        });
      }
    };

    Notifications.getLastNotificationResponseAsync().then(handleResponse);
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => handleResponse(response),
    );

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        alarmEngine.refresh();
      }
    });

    return () => {
      sub.remove();
      appStateSub.remove();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="verify" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}