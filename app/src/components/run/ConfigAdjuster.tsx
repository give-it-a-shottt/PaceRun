import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CaretDownIcon, CaretRightIcon, MinusIcon, PlusIcon, type IconProps } from '@/components/icons';
import { describeConfig, describeEstimate } from '@/domain/runConfig';
import type { RunConfig } from '@/domain/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

import { CONFIG_TITLE, configFields, type ConfigField } from './configFields';

type Props = {
  config: RunConfig;
  onChange: (next: RunConfig) => void;
};

const ROW_HEIGHT = 56;
const FIELD_HEIGHT = 48;
/** 누르는 영역은 44, 보이는 동그라미는 32 */
const STEP_TOUCH_SIZE = 44;
const STEP_CIRCLE_SIZE = 32;
/** 값이 바뀌어도 양옆 버튼이 흔들리지 않게 가장 긴 값("1분 30초")에 맞춘 너비 */
const VALUE_MIN_WIDTH = 80;

/**
 * 고른 모드의 목표값 줄. 줄을 누르면 아래에 값을 줄이고 늘리는 칸이 펼쳐진다.
 * (피그마에는 줄만 있어서 펼친 모양은 List Row · Filled 규칙에 맞춰 만들었다.)
 */
export function ConfigAdjuster({ config, onChange }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const title = CONFIG_TITLE[config.mode];
  const summary = describeConfig(config);
  // 시간을 직접 고르지 않는 모드만 예상 시간을 따로 알려 준다
  const estimate = config.mode === 'interval' || config.mode === 'pacemaker' ? describeEstimate(config) : null;
  const Caret = open ? CaretDownIcon : CaretRightIcon;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${summary}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.row}>
        <AppText variant="body16R">{title}</AppText>
        <AppText variant="body15R" color="textSub" numberOfLines={1} style={styles.summary}>
          {summary}
        </AppText>
        <Caret size={20} color={colors.iconSub} />
      </Pressable>
      {open ? (
        <View style={[styles.panel, { backgroundColor: colors.bgLight }]}>
          {configFields(config).map((field) => (
            <FieldRow key={field.key} field={field} onChange={onChange} />
          ))}
          {estimate ? (
            <AppText variant="caption12R" color="textSub" style={styles.estimate}>
              예상 시간 {estimate}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function FieldRow({ field, onChange }: { field: ConfigField; onChange: (next: RunConfig) => void }) {
  return (
    <View style={styles.field}>
      <AppText variant="body15R" style={styles.fieldLabel}>
        {field.label}
      </AppText>
      <StepButton icon={MinusIcon} label={`${field.label} 줄이기`} next={field.decreased} onChange={onChange} />
      <AppText variant="title16SB" tabular accessibilityLiveRegion="polite" style={styles.fieldValue}>
        {field.valueText}
      </AppText>
      <StepButton icon={PlusIcon} label={`${field.label} 늘리기`} next={field.increased} onChange={onChange} />
    </View>
  );
}

function StepButton({
  icon: Icon,
  label,
  next,
  onChange,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  /** 눌렀을 때의 설정. 범위 끝이면 null */
  next: RunConfig | null;
  onChange: (next: RunConfig) => void;
}) {
  const { colors } = useTheme();
  const disabled = next == null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (next) onChange(next);
      }}
      style={styles.stepTouch}>
      {({ pressed }) => (
        <View
          style={[
            styles.stepCircle,
            {
              borderColor: colors.lineRegular,
              backgroundColor: pressed ? colors.bgRegular : colors.bgDefault,
              opacity: disabled ? 0.4 : 1,
            },
          ]}>
          <Icon size={16} color={colors.iconMain} weight="bold" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  summary: { flex: 1, textAlign: 'right' },
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
  estimate: { paddingBottom: space[2], paddingRight: space[2] },
});
