import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

/** 설정 묶음: 작은 제목 + 그 아래의 행들 */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption12SB" color="textSub" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

/** 묶음 사이를 나누는 12 높이 띠(피그마 Band 12) */
export function Band() {
  const { colors } = useTheme();
  return <View style={[styles.band, { backgroundColor: colors.bgRegular }]} />;
}

const styles = StyleSheet.create({
  section: { paddingTop: space[4], paddingBottom: space[2], paddingHorizontal: layout.screenPaddingX },
  band: { height: space[3] },
});
