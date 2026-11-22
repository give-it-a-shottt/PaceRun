import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BatteryWarningIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

import { TextLink } from './TextLink';

/** RUN_02_005 배터리 경고 배너. 배터리 최적화를 풀지 않았을 때 시작 전 설정 시트 위쪽에 둔다. */
export function BatteryBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: colors.statusWarningBg }]}>
      <BatteryWarningIcon size={20} color={colors.statusWarningBase} />
      <View style={styles.body}>
        <AppText variant="body13R" color="statusWarningText">
          배터리 최적화가 켜져 있어요. 화면을 끄면 기록이 끊길 수 있어요.
        </AppText>
        <TextLink label="설정 열기" variant="caption12SB" onPress={onOpenSettings} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingLeft: space[3],
    paddingRight: space[4],
    paddingVertical: space[3],
    borderRadius: radius.button,
  },
  body: { flex: 1, alignItems: 'flex-start', gap: space[1] },
});
