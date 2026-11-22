import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, space, type Colors, type TypographyName } from '@/theme/tokens';

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
  /** 아이콘 굵기. 기본은 면(fill)이고, 피그마에서 선으로 그린 아이콘만 regular로 준다. */
  iconWeight?: 'regular' | 'fill';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const HEIGHT: Record<ButtonSize, number> = { L: 48, XL: 56 };
const LABEL: Record<ButtonSize, TypographyName> = { L: 'title16SB', XL: 'title18SB' };
const PADDING_X: Record<ButtonSize, number> = { L: space[5], XL: space[6] };

function palette(variant: ButtonVariant, colors: Colors, pressed: boolean) {
  switch (variant) {
    case 'primary':
      return {
        bg: pressed ? colors.primaryPressed : colors.primaryDefault,
        fg: colors.textOnPrimary,
        icon: colors.iconOnPrimary,
        border: undefined,
      };
    case 'strong':
      return { bg: colors.bgInverse, fg: colors.textInverse, icon: colors.iconInverse, border: undefined };
    case 'outlineStrong':
      return { bg: colors.bgDefault, fg: colors.textMain, icon: colors.iconMain, border: colors.lineBlack };
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
  iconWeight = 'fill',
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
            paddingHorizontal: PADDING_X[size],
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
            {Icon ? <Icon size={20} color={p.icon} weight={iconWeight} /> : null}
            <AppText variant={LABEL[size]} style={{ color: p.fg }}>
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
    borderRadius: radius.button,
    alignSelf: 'stretch',
  },
});
