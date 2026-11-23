import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

const OPTION_MIN_HEIGHT = 48;
const CHECK_SIZE = 20;

export type Choice<T> = {
  value: T;
  label: string;
  /** 이름 아래에 작게 붙는 설명 줄 */
  description?: string;
};

type Props<T> = {
  /** 화면을 읽어 주는 기능이 말할 목록 이름 */
  label: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * 여럿 가운데 하나 고르기(세로 목록). 주 목표 고르기(WeeklyGoalPicker)와 같은 방식으로,
 * 선택은 색만이 아니라 체크와 굵은 글자로도 보여 준다.
 */
export function ChoiceList<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.list}>
      {options.map((option) => {
        const selected = option.value === value;
        const borderWidth = selected ? 2 : 1;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.description ? `${option.label}, ${option.description}` : option.label}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              {
                borderWidth,
                // 테두리 굵기가 달라져도 칸 크기와 안쪽 글자 위치가 그대로이게 한다
                paddingHorizontal: space[4] - borderWidth,
                paddingVertical: space[3] - borderWidth,
                borderColor: selected ? colors.laneDone : colors.lineRegular,
                backgroundColor: selected ? colors.primarySoft : pressed ? colors.bgLight : colors.bgDefault,
              },
            ]}>
            <View style={styles.text}>
              <AppText variant={selected ? 'title16SB' : 'body16R'}>{option.label}</AppText>
              {option.description ? (
                <AppText variant="body13R" color="textSub">
                  {option.description}
                </AppText>
              ) : null}
            </View>
            {/* 고르지 않은 칸도 체크 자리를 비워 두어, 고를 때 글자 줄바꿈이 달라지지 않게 한다 */}
            <View style={styles.check}>
              {selected ? <CheckIcon size={CHECK_SIZE} color={colors.iconMain} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  option: {
    minHeight: OPTION_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radius.button,
  },
  text: { flex: 1, gap: space[0.5] },
  check: { width: CHECK_SIZE, height: CHECK_SIZE },
});
