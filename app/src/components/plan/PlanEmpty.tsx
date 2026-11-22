import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CalendarBlankIcon, PlusIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

type Props = {
  onPickTemplate: () => void;
  onAddWorkout: () => void;
};

const ICON_CIRCLE_SIZE = 80;
const ICON_SIZE = 40;

/** PLN_01_004 계획 빈 상태: 안내와 [템플릿 고르기] · [직접 추가] */
export function PlanEmpty({ onPickTemplate, onAddWorkout }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <View style={[styles.iconCircle, { backgroundColor: colors.bgRegular }]}>
        <CalendarBlankIcon size={ICON_SIZE} color={colors.iconSub} />
      </View>
      <AppText variant="headline20SB" accessibilityRole="header" style={styles.center}>
        이번 주 계획이 없어요
      </AppText>
      <AppText variant="body15R" color="textSub" style={styles.center}>
        템플릿을 고르면 요일별 운동이 자동으로 채워져요. 하나씩 직접 추가해도 돼요.
      </AppText>
      <View style={styles.actions}>
        <Button label="템플릿 고르기" onPress={onPickTemplate} />
        <Button label="직접 추가" variant="outlineStrong" icon={PlusIcon} iconWeight="regular" onPress={onAddWorkout} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[8],
    paddingVertical: space[6],
  },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space[2] },
});
