import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { LockSimpleIcon } from '@/components/icons';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { layout, radius, space } from '@/theme/tokens';

import { useHoldProgress } from './useHoldProgress';

type Props = {
  /** 지금 상태 한 줄. 예: "달리기 0:42" */
  statusText: string;
  /** 그 옆 작은 글자. 예: "5 / 16 구간" */
  detailText?: string;
  /** 화면을 1.5초 동안 누르고 있었을 때 불린다. */
  onUnlock: () => void;
};

/**
 * 주머니 모드(RUN_01_005, Plan B). 화면을 켜 둔 채 어두운 화면으로 덮고 터치를 막는다.
 * 러닝 화면 위에 올려 쓰고, 테마 설정과 상관없이 항상 Dark로 그린다.
 */
export function PocketMode(props: Props) {
  return (
    <ThemeProvider scheme="dark">
      <PocketModeBody {...props} />
    </ThemeProvider>
  );
}

function PocketModeBody({ statusText, detailText, onUnlock }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { progress, start, cancel } = useHoldProgress(onUnlock, { vibrateOnStart: false });

  return (
    // 화면 전체가 누르는 영역이라, 아래에 깔린 러닝 화면의 버튼에는 터치가 닿지 않는다
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="주머니 모드 잠금 해제"
      accessibilityHint="화면을 1.5초 동안 누르고 있으면 잠금이 풀려요"
      onPressIn={start}
      onPressOut={cancel}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgLight, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={[styles.lock, { backgroundColor: colors.bgRegular }]}>
          <LockSimpleIcon size={32} color={colors.iconSub} />
        </View>
        <AppText variant="headline20SB">주머니 모드</AppText>
        <AppText variant="body15R" color="textSub" style={styles.description}>
          화면을 켜 둔 채 터치를 잠갔어요. 안내는 소리로 계속 나와요.
        </AppText>
        <View style={styles.status}>
          <AppText variant="title18SB" tabular>
            {statusText}
          </AppText>
          {detailText ? (
            <AppText variant="body14R" color="textSub" tabular>
              {detailText}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(BOTTOM_PADDING, insets.bottom + space[4]) }]}>
        <View style={[styles.ring, { borderColor: colors.lineBlack }]}>
          <Animated.View
            style={[styles.ringFill, { backgroundColor: colors.lineBlack, transform: [{ scale: progress }] }]}
          />
        </View>
        <AppText variant="caption13M" color="textSub">
          화면을 길게 눌러 잠금 해제
        </AppText>
      </View>
    </Pressable>
  );
}

const RING_SIZE = 56;
const LOCK_SIZE = 64;
const BOTTOM_PADDING = space[12];

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[8],
  },
  lock: {
    width: LOCK_SIZE,
    height: LOCK_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { textAlign: 'center' },
  // 피그마의 24 간격을 묶음 사이 간격(16) 위에 더한다
  status: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[6] + space[4] },
  bottom: {
    alignItems: 'center',
    gap: space[2],
    paddingTop: space[4],
    paddingHorizontal: layout.screenPaddingX,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringFill: { width: RING_SIZE, height: RING_SIZE, borderRadius: radius.full },
});
