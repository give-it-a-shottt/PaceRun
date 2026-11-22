import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ToastHost } from '@/components/Toast';
// 화면이 뜨기 전에 백그라운드 위치 작업과 그 위치를 받을 곳이 등록돼 있어야 한다(import만으로 등록된다).
// 앱이 죽었다가 위치 작업으로 되살아났을 때 러닝을 이어 가려면 필요하다.
import '@/services/runController';
import { SETTINGS_LOAD_ERROR, useSettingsStore } from '@/state/settingsStore';
import { ThemeProvider } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

// 화면을 그리다 예외가 나면 흰 화면 대신 expo-router의 오류 화면(다시 시도 버튼)을 보여 준다.
export { ErrorBoundary } from 'expo-router';

// 설정을 읽기 전에 화면이 보이면 첫 실행 분기가 깜빡이므로, 읽을 때까지 스플래시를 붙잡아 둔다.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useSettingsStore((s) => s.status);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    // 앱 기본은 Light. 러닝 화면만 자기 레이아웃에서 Dark로 바꾼다.
    <ThemeProvider scheme="light">
      <StatusBar style="dark" />
      {status === 'failed' ? (
        // 설정을 못 읽은 채로 진행하면 기본값(첫 실행)으로 열려 온보딩이 다시 뜨므로 여기서 멈춘다.
        <SettingsLoadFailed onRetry={load} />
      ) : (
        <Stack screenOptions={{ headerShown: false }} />
      )}
      <ToastHost />
    </ThemeProvider>
  );
}

function SettingsLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.failed}>
        <AppText variant="title18SB">{SETTINGS_LOAD_ERROR}</AppText>
        <AppText color="textSub">폰 저장 공간을 확인한 뒤 다시 시도해 주세요. 기록은 지워지지 않아요.</AppText>
        <Button label="다시 시도" onPress={onRetry} style={styles.retry} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  failed: { flex: 1, justifyContent: 'center', padding: space[5], gap: space[2] },
  retry: { marginTop: space[4] },
});
