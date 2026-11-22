import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeContext';

/** 첫 실행 온보딩 3단계(권한 → 배터리 최적화 → 주 목표). 앞 단계로는 뒤로 가기로 돌아간다. */
export default function OnboardingLayout() {
  const { colors } = useTheme();

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgDefault } }} />;
}
