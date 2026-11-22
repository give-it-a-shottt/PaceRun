import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import type { LaneView } from '@/domain/runView';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

// 피그마 Lane Segment(6:58)의 값. 모서리 · 테두리는 피그마에 변수가 없어 숫자 그대로다.
const RUN_HEIGHT = 24;
const WALK_HEIGHT = 12;
const CELL_RADIUS = 2;
const CURRENT_BORDER = 2;
/** pacerun-design.md 5장 모션 스펙 "레인 칸 전환" */
const SWITCH_DURATION_MS = 200;

/** 칸이 많아지면 간격만으로 화면 너비를 넘기 때문에 간격을 줄인다(반복은 99회 = 198칸까지 된다). */
function gapFor(count: number): number {
  if (count <= 40) return space[1];
  if (count <= 80) return space[0.5];
  return 0;
}

/** 시스템의 '동작 줄이기' 설정. 켜져 있으면 칸 전환을 바로 보여 준다. */
function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

/** 인터벌 구간 띠. 받은 값을 그리기만 한다: 지나온 칸 · 지금 칸(테두리 + 진행 채움) · 남은 칸. */
export function Lane({ lane }: { lane: LaneView }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const shownIndex = useRef(lane.currentIndex);

  useEffect(() => () => opacity.stopAnimation(), [opacity]);

  // 칸이 바뀔 때만 새 지금 칸을 서서히 보여 준다(처음 그릴 때와 진행 채움은 움직이지 않는다)
  useLayoutEffect(() => {
    if (shownIndex.current === lane.currentIndex) return;
    shownIndex.current = lane.currentIndex;
    opacity.stopAnimation();
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: SWITCH_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [lane.currentIndex, reduceMotion, opacity]);

  const progressPercent = Math.min(1, Math.max(0, lane.progress)) * 100;

  return (
    <View accessible accessibilityLabel={`${lane.countText}, ${lane.caption}`} style={styles.root}>
      <View style={[styles.cells, { gap: gapFor(lane.steps.length) }]}>
        {lane.steps.map((step, index) => {
          const size = { flexGrow: step.durationMs, height: step.kind === 'run' ? RUN_HEIGHT : WALK_HEIGHT };

          if (index !== lane.currentIndex) {
            const color = index < lane.currentIndex ? colors.laneDone : colors.lineLight;
            return <View key={index} style={[styles.cell, size, { backgroundColor: color }]} />;
          }

          return (
            <Animated.View key={index} style={[styles.cell, size, { opacity }]}>
              <View style={[styles.currentInside, { backgroundColor: colors.bgDefault }]}>
                <View style={[styles.progress, { width: `${progressPercent}%`, backgroundColor: colors.laneDone }]} />
              </View>
              <View style={[styles.currentBorder, { borderColor: colors.lineBlack }]} />
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.texts}>
        <AppText variant="caption12R" color="textSub" numberOfLines={1} style={styles.caption}>
          {lane.caption}
        </AppText>
        <AppText variant="caption12SB" tabular>
          {lane.countText}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', gap: space[2] },
  cells: { flexDirection: 'row', alignItems: 'center' },
  // 너비는 구간 시간 비율로만 정한다(칸이 많아도 한 줄에 들어가게 최소 너비를 두지 않는다)
  cell: { flexBasis: 0, flexShrink: 1, minWidth: 0, borderRadius: CELL_RADIUS },
  currentInside: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: CELL_RADIUS,
    overflow: 'hidden',
  },
  progress: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  // 테두리는 칸 바깥에 그린다(칸 너비는 다른 칸과 같은 비율을 유지한다)
  currentBorder: {
    position: 'absolute',
    top: -CURRENT_BORDER,
    right: -CURRENT_BORDER,
    bottom: -CURRENT_BORDER,
    left: -CURRENT_BORDER,
    borderWidth: CURRENT_BORDER,
    borderRadius: CELL_RADIUS + CURRENT_BORDER,
  },
  texts: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[2] },
  caption: { flex: 1 },
});
