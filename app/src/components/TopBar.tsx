import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { layout, space, type ColorName } from '@/theme/tokens';

import { AppText } from './AppText';
import { CaretLeftIcon, type IconProps } from './icons';

/** 제목 오른쪽의 아이콘 버튼(피그마 Top Bar의 Action, 터치 영역 44). 예: 계획 탭의 [+] */
export type TopBarAction = { icon: ComponentType<IconProps>; label: string; onPress: () => void };

type Props = (
  | { variant: 'logo' }
  | { variant: 'title'; title: string; action?: TopBarAction }
  | { variant: 'back'; title?: string; onBack?: () => void }
) & {
  /** 바탕색. 화면 바탕이 흰색이 아닐 때(계획 탭의 bgLight) 화면과 맞춘다. 기본은 bgDefault. */
  background?: ColorName;
};

/** 상단 바 56. 홈 = 로고 / 탭 화면 = 제목 / 하위 화면 = 뒤로 가기. */
export function TopBar(props: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: colors[props.background ?? 'bgDefault'] }]}>
      {props.variant === 'logo' ? (
        <>
          <Image
            source={require('@/assets/images/logo-mark.svg')}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
          <AppText variant="headline20SB" accessibilityRole="header" style={styles.logoTitle}>
            Pace Run
          </AppText>
        </>
      ) : null}

      {props.variant === 'back' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            hitSlop={8}
            onPress={props.onBack ?? (() => router.back())}
            style={styles.back}>
            <CaretLeftIcon size={24} color={colors.iconMain} />
          </Pressable>
          {props.title ? (
            <AppText variant="title18SB" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
              {props.title}
            </AppText>
          ) : null}
        </>
      ) : null}

      {props.variant === 'title' ? (
        <>
          <AppText variant="headline20SB" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
            {props.title}
          </AppText>
          {props.action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={props.action.label}
              onPress={props.action.onPress}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <props.action.icon size={24} color={colors.iconMain} />
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: layout.screenPaddingX,
    paddingRight: space[2],
  },
  logo: { width: 28, height: 28 },
  logoTitle: { flex: 1, marginLeft: space[3] },
  back: { width: 44, height: 44, marginLeft: -space[3], alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
