import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { MinusIcon, PlusIcon, type IconProps } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

const FIELD_HEIGHT = 48;
/** 누르는 영역은 44, 보이는 동그라미는 32 */
const STEP_TOUCH_SIZE = 44;
const STEP_CIRCLE_SIZE = 32;
/** 값이 바뀌어도 양옆 버튼이 흔들리지 않게 가장 긴 값("오전 12시")에 맞춘 너비 */
const VALUE_MIN_WIDTH = 80;

/** − / + 칸들을 담는 옅은 회색 상자. 시작 전 설정의 목표값 칸(ConfigAdjuster)과 같은 모양이다. */
export function FieldPanel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.panel, { backgroundColor: colors.bgLight }]}>{children}</View>;
}

type Props = {
  label: string;
  valueText: string;
  onDecrease: () => void;
  onIncrease: () => void;
  /** 범위 끝이라 더 줄일 수 없으면 false. 주지 않으면 늘 누를 수 있다(시 · 분처럼 끝에서 도는 값). */
  canDecrease?: boolean;
  canIncrease?: boolean;
};

/** 이름 + [−] 값 [+] 한 줄. 한 칸씩 줄이고 늘리는 값에 쓴다. */
export function StepField({ label, valueText, onDecrease, onIncrease, canDecrease = true, canIncrease = true }: Props) {
  return (
    <View style={styles.field}>
      <AppText variant="body15R" style={styles.fieldLabel}>
        {label}
      </AppText>
      <StepButton icon={MinusIcon} label={`${label} 줄이기`} disabled={!canDecrease} onPress={onDecrease} />
      <AppText variant="title16SB" tabular accessibilityLiveRegion="polite" style={styles.fieldValue}>
        {valueText}
      </AppText>
      <StepButton icon={PlusIcon} label={`${label} 늘리기`} disabled={!canIncrease} onPress={onIncrease} />
    </View>
  );
}

function StepButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.stepTouch}>
      {({ pressed }) => (
        <View
          style={[
            styles.stepCircle,
            { borderColor: colors.lineRegular, backgroundColor: pressed ? colors.bgRegular : colors.bgDefault },
            disabled && styles.stepDisabled,
          ]}>
          <Icon size={16} color={colors.iconMain} weight="bold" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.button, paddingLeft: space[4], paddingRight: space[2], paddingVertical: space[1] },
  field: { height: FIELD_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { flex: 1 },
  fieldValue: { minWidth: VALUE_MIN_WIDTH, textAlign: 'center' },
  stepTouch: { width: STEP_TOUCH_SIZE, height: STEP_TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  stepCircle: {
    width: STEP_CIRCLE_SIZE,
    height: STEP_CIRCLE_SIZE,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
});
