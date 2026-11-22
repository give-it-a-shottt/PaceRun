import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { CaretLeftIcon } from './icons';

type Props =
  | { variant: 'logo' }
  | { variant: 'title'; title: string }
  | { variant: 'back'; title?: string; onBack?: () => void };

/** 상단 바 56. 홈 = 로고 / 탭 화면 = 제목 / 하위 화면 = 뒤로 가기. */
export function TopBar(props: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.bar, { backgroundColor: colors.bgDefault }]}>
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
        <AppText variant="headline20SB" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
          {props.title}
        </AppText>
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
});
