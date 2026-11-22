import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider } from '@/theme/ThemeContext';
import { darkColors, lightColors } from '@/theme/tokens';
import { useRunScheme } from '@/theme/useRunScheme';

/** 러닝 화면 묶음(카운트다운 · 러닝 중 · 완료 요약). 앱에서 여기만 Dark가 될 수 있다. */
export default function RunLayout() {
  const scheme = useRunScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeProvider scheme={scheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          // 뛰는 중에 화면 가장자리를 쓸어 러닝 화면을 벗어나지 않게 한다
          gestureEnabled: false,
          // 화면이 바뀌는 사이에 흰 바탕이 비치지 않게 한다(Dark)
          contentStyle: { backgroundColor: colors.bgDefault },
        }}
      />
    </ThemeProvider>
  );
}
