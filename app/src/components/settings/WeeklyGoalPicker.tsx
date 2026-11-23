import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckIcon } from '@/components/icons';
import { WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN } from '@/domain/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

const OPTION_HEIGHT = 48;
const CHECK_SIZE = 16;

const GOALS = Array.from({ length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 }, (_, index) => WEEKLY_GOAL_MIN + index);

type Props = {
  value: number;
  onChange: (goal: number) => void;
};

/**
 * 주 목표 횟수 고르기(2~5회 가운데 하나). 온보딩 3단계와 설정의 주 목표 시트가 함께 쓴다.
 * 선택은 색만이 아니라 체크와 굵은 글자로도 보여 준다.
 */
export function WeeklyGoalPicker({ value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="주 목표 횟수" style={styles.row}>
      {GOALS.map((goal) => {
        const selected = goal === value;
        return (
          <Pressable
            key={goal}
            accessibilityRole="radio"
            accessibilityLabel={`주 ${goal}회`}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(goal)}
            style={({ pressed }) => [
              styles.option,
              {
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.laneDone : colors.lineRegular,
                backgroundColor: selected ? colors.primarySoft : pressed ? colors.bgLight : colors.bgDefault,
              },
            ]}>
            {selected ? <CheckIcon size={CHECK_SIZE} color={colors.iconMain} /> : null}
            <AppText variant={selected ? 'title16SB' : 'body16R'}>{goal}회</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2] },
  option: {
    flex: 1,
    height: OPTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    borderRadius: radius.button,
  },
});
