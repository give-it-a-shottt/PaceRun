import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, space, type Colors } from '@/theme/tokens';

import { AppText } from './AppText';
import type { IconProps } from './icons';

/**
 * primary = Plum(주 행동, 한 영역에 1개) / strong = 반전(러닝 화면 Light의 주 행동) /
 * outlineStrong = 테두리(보조, 러닝 화면 Dark의 주 행동)
 */
export type ButtonVariant = 'primary' | 'strong' | 'outlineStrong';
export type ButtonSize = 'L' | 'XL';

type Props = {
  label: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ComponentType<IconProps>;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const HEIGHT: Record<ButtonSize, number> = { L: 48, XL: 56 };

function palette(variant: ButtonVariant, colors: Colors, pressed: boolean) {
  switch (variant) {
    case 'primary':
      return {
        bg: pressed ? colors.primaryPressed : colors.primaryDefault,
        fg: colors.textOnPrimary,
        border: undefined,
      };
    case 'strong':
      return { bg: colors.bgInverse, fg: colors.textInverse, border: undefined };
    case 'outlineStrong':
      return { bg: colors.bgDefault, fg: colors.textMain, border: colors.lineBlack };
  }
}

export function Button({
  label,
  onPress,
  onPressIn,
  onPressOut,
  variant = 'primary',
  size = 'L',
  icon: Icon,
  disabled,
  loading,
  style,
  accessibilityHint,
}: Props) {
  const { colors, scheme } = useTheme();
  const inactive = disabled || loading;
  // 러닝 화면 Dark의 테두리 버튼만 2px(pacerun-design.md 3장), 나머지는 1px
  const borderWidth = variant === 'outlineStrong' ? (scheme === 'dark' ? 2 : 1) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => {
        const p = palette(variant, colors, pressed);
        return [
          styles.base,
          {
            height: HEIGHT[size],
            backgroundColor: p.bg,
            borderColor: p.border,
            borderWidth,
            opacity: inactive ? 0.4 : pressed && variant !== 'primary' ? 0.8 : 1,
          },
          style,
        ];
      }}>
      {({ pressed }) => {
        const p = palette(variant, colors, pressed);
        return loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <>
            {Icon ? <Icon size={20} color={p.fg} weight="fill" /> : null}
            <AppText variant="title16SB" style={{ color: p.fg }}>
              {label}
            </AppText>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[5],
    borderRadius: radius.button,
    alignSelf: 'stretch',
  },
});
