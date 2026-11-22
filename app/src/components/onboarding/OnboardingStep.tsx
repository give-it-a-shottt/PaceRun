import type { ComponentType, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import type { IconProps } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme/ThemeContext';
import { layout, radius, space } from '@/theme/tokens';

import { StepIndicator } from './StepIndicator';

export const ONBOARDING_TOTAL_STEPS = 3;

const ICON_CIRCLE_SIZE = 80;
const ICON_SIZE = 40;
const TEXT_ACTION_HEIGHT = 44;

type Props = {
  step: number;
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
  /** 설명 아래에 놓는 그 단계만의 내용 */
  children?: ReactNode;
  /** 화면 아래에 붙어 있는 버튼들. 내용이 길어 스크롤돼도 항상 보인다. */
  footer: ReactNode;
};

/** 온보딩 세 단계가 함께 쓰는 틀: 단계 표시 → 아이콘 → 제목 · 설명 → 내용, 아래에 버튼. */
export function OnboardingStep({ step, icon: Icon, title, description, children, footer }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // 제스처 바는 34로 충분하지만, 3버튼 내비게이션 바는 더 높아서 버튼이 가려지지 않게 넓힌다
  const paddingBottom = Math.max(layout.bottomSafePadding, insets.bottom + space[2]);

  return (
    <Screen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <StepIndicator step={step} total={ONBOARDING_TOTAL_STEPS} />
        <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
          <Icon size={ICON_SIZE} color={colors.iconMain} />
        </View>
        <View style={styles.texts}>
          <AppText variant="headline24SB" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="body15R" color="textSub">
            {description}
          </AppText>
        </View>
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom }]}>{footer}</View>
    </Screen>
  );
}

type TextActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/** 주 버튼 아래의 보조 행동(나중에 할게요 · 건너뛰기). 피그마에서 밑줄 없는 글자 버튼이다. */
export function OnboardingTextAction({ label, onPress, disabled }: TextActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.textAction, (pressed || disabled) && styles.textActionDim]}>
      <AppText variant="body14M" color="textSub">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingTop: space[6], paddingHorizontal: space[6], gap: space[8] },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { gap: space[3] },
  footer: { paddingTop: space[4], paddingHorizontal: layout.screenPaddingX, gap: space[1] },
  textAction: { height: TEXT_ACTION_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  textActionDim: { opacity: 0.6 },
});
