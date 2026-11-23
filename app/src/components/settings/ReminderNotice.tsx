import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { WarningIcon } from '@/components/icons';
import { TextLink } from '@/components/run/TextLink';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

type Props = {
  /** 안내 문구(describeSettings가 만든 것) */
  message: string;
  onOpenSettings: () => void;
};

/**
 * 알림을 켜 두었는데 폰의 알림 권한이 꺼져 있을 때 알림 시간 행 아래에 두는 안내.
 * (피그마에 없어서 배터리 경고 배너와 같은 모양으로 만들었다.)
 */
export function ReminderNotice({ message, onOpenSettings }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: colors.statusWarningBg }]}>
      <WarningIcon size={20} color={colors.statusWarningBase} />
      <View style={styles.body}>
        <AppText variant="body13R" color="statusWarningText">
          {message}
        </AppText>
        <TextLink label="설정 열기" variant="caption12SB" onPress={onOpenSettings} />
      </View>
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
    marginBottom: space[2],
    borderRadius: radius.button,
  },
  body: { flex: 1, alignItems: 'flex-start', gap: space[1] },
});
