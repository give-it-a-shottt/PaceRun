import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CaretDownIcon, CaretRightIcon, MinusIcon, PlusIcon, type IconProps } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

import {
  formatReminderClock,
  formatReminderHour,
  formatReminderMinute,
  stepHour,
  stepMinute,
  type ReminderClock,
} from '@/domain/reminderTime';
import { Toggle } from './Toggle';

export type ReminderChoice = {
  /** 알림을 받을지. 꺼도 고른 시각은 기억해 두었다가 다시 켜면 보여 준다. */
  enabled: boolean;
  clock: ReminderClock;
};

type Props = {
  value: ReminderChoice;
  onChange: (next: ReminderChoice) => void;
};

const ROW_HEIGHT = 56;
const FIELD_HEIGHT = 48;
/** 누르는 영역은 44, 보이는 동그라미는 32 */
const STEP_TOUCH_SIZE = 44;
const STEP_CIRCLE_SIZE = 32;
/** 값이 바뀌어도 양옆 버튼이 흔들리지 않게 가장 긴 값("오전 12시")에 맞춘 너비 */
const VALUE_MIN_WIDTH = 80;

const TOGGLE_LABEL = '매일 알림 받기';

/**
 * 알림 시간 줄. 줄을 누르면 아래에 켜기/끄기와 시 · 분을 고르는 칸이 펼쳐진다.
 * (피그마에는 줄만 있고 시각 선택용 패키지가 없어서, 펼친 모양은 시작 전 설정의 목표값 칸과 같게 만들었다.)
 */
export function ReminderTimePicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const summary = value.enabled ? `매일 ${formatReminderClock(value.clock)}` : '끔';
  const Caret = open ? CaretDownIcon : CaretRightIcon;

  const setClock = (clock: ReminderClock) => onChange({ ...value, clock });

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`알림 시간, ${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.row}>
        <AppText variant="body16R" style={styles.rowTitle}>
          알림 시간
        </AppText>
        <AppText variant="body15R" color="textSub" numberOfLines={1}>
          {summary}
        </AppText>
        <Caret size={20} color={colors.iconSub} />
      </Pressable>
      {open ? (
        <View style={[styles.panel, { backgroundColor: colors.bgLight }]}>
          <View style={[styles.field, styles.toggleField]}>
            <AppText variant="body15R" style={styles.fieldLabel}>
              {TOGGLE_LABEL}
            </AppText>
            <Toggle
              label={TOGGLE_LABEL}
              value={value.enabled}
              onChange={(enabled) => onChange({ ...value, enabled })}
            />
          </View>
          {value.enabled ? (
            <>
              <StepField
                label="시"
                valueText={formatReminderHour(value.clock.hour)}
                onDecrease={() => setClock(stepHour(value.clock, -1))}
                onIncrease={() => setClock(stepHour(value.clock, 1))}
              />
              <StepField
                label="분"
                valueText={formatReminderMinute(value.clock.minute)}
                onDecrease={() => setClock(stepMinute(value.clock, -1))}
                onIncrease={() => setClock(stepMinute(value.clock, 1))}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function StepField({
  label,
  valueText,
  onDecrease,
  onIncrease,
}: {
  label: string;
  valueText: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="body15R" style={styles.fieldLabel}>
        {label}
      </AppText>
      <StepButton icon={MinusIcon} label={`${label} 줄이기`} onPress={onDecrease} />
      <AppText variant="title16SB" tabular accessibilityLiveRegion="polite" style={styles.fieldValue}>
        {valueText}
      </AppText>
      <StepButton icon={PlusIcon} label={`${label} 늘리기`} onPress={onIncrease} />
    </View>
  );
}

function StepButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.stepTouch}>
      {({ pressed }) => (
        <View
          style={[
            styles.stepCircle,
            { borderColor: colors.lineRegular, backgroundColor: pressed ? colors.bgRegular : colors.bgDefault },
          ]}>
          <Icon size={16} color={colors.iconMain} weight="bold" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowTitle: { flex: 1 },
  panel: { borderRadius: radius.button, paddingLeft: space[4], paddingRight: space[2], paddingVertical: space[1] },
  field: { height: FIELD_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  // 스위치는 − / + 버튼처럼 누르는 영역 여백을 갖고 있지 않아서 오른쪽을 맞춰 준다
  toggleField: { paddingRight: space[2] },
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
});
