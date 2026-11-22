import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastHost } from '@/components/Toast';
import { useSettingsStore } from '@/state/settingsStore';
import { ThemeProvider } from '@/theme/ThemeContext';

// 설정을 읽기 전에 화면이 보이면 첫 실행 분기가 깜빡이므로, 읽을 때까지 스플래시를 붙잡아 둔다.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    // 앱 기본은 Light. 러닝 화면만 자기 레이아웃에서 Dark로 바꾼다.
    <ThemeProvider scheme="light">
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
      <ToastHost />
    </ThemeProvider>
  );
}
