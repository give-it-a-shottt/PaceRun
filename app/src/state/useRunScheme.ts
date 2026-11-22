import { useColorScheme } from 'react-native';

import type { ThemeScheme } from '@/theme/ThemeContext';

import { useSettingsStore } from './settingsStore';

/**
 * 러닝 화면 묶음의 테마. 설정 '러닝 화면 테마'가 자동이면 OS의 다크 설정을 따르고,
 * '항상 밝게'면 OS가 다크여도 Light를 쓴다(pacerun-design.md 7장).
 */
export function useRunScheme(): ThemeScheme {
  const osScheme = useColorScheme();
  const runTheme = useSettingsStore((s) => s.settings.runTheme);
  if (runTheme === 'light') return 'light';
  return osScheme === 'dark' ? 'dark' : 'light';
}
