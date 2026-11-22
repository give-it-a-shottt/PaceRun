import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { GpsSlashIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, shadow, space } from '@/theme/tokens';

export const GPS_SEARCHING_MESSAGE = 'GPS 신호를 찾는 중이에요. 하늘이 트인 곳으로 이동해 보세요.';

/**
 * RUN_02_001 "GPS 신호를 찾는 중" 안내(토스트 모양).
 * 신호를 찾는 동안 계속 보여야 하고 시트(Modal) 위에도 떠야 해서, 3초짜리 앱 토스트 대신 따로 그린다.
 */
export function GpsNotice() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: colors.bgInverse, boxShadow: shadow.toast }]}>
      <GpsSlashIcon size={20} color={colors.iconInverse} />
      <AppText variant="caption13M" color="textInverse" style={styles.text}>
        {GPS_SEARCHING_MESSAGE}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.button,
  },
  text: { flex: 1 },
});
