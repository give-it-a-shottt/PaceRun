import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { IconProps } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

/**
 * 동기화 상태 화면의 안내 한 줄(마지막 동기화가 실패한 까닭 · 서버가 받지 않는 기록).
 * 피그마에 없어서 배터리 경고 배너 · 알림 권한 안내와 같은 모양으로 만들었다.
 */
export function SyncNotice({ icon: Icon, message }: { icon: ComponentType<IconProps>; message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: colors.statusWarningBg }]}>
      <Icon size={20} color={colors.statusWarningBase} />
      <AppText variant="body13R" color="statusWarningText" style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    paddingLeft: space[3],
    paddingRight: space[4],
    paddingVertical: space[3],
    borderRadius: radius.button,
  },
  text: { flex: 1 },
});
