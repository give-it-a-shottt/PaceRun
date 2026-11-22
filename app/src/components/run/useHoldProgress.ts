import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { vibrate } from '@/services/haptics';

/** 실수로 눌리는 것을 막기 위한 대기 시간(pacerun-design.md 5장 모션 스펙). */
export const HOLD_DURATION_MS = 1500;
const RELEASE_DURATION_MS = 200;

type Options = {
  /** 누르기 시작할 때도 진동을 줄지. 주머니 안에서 스치기만 해도 울리면 안 되는 곳은 끈다. */
  vibrateOnStart?: boolean;
};

/**
 * 길게 누르기의 진행 값(0 → 1). 끝까지 누르고 있으면 onComplete를 부르고, 중간에 떼면 0으로 돌아간다.
 */
export function useHoldProgress(onComplete: () => void, { vibrateOnStart = true }: Options = {}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => () => progress.stopAnimation(), [progress]);

  const start = () => {
    if (vibrateOnStart) vibrate('start');
    // 돌아가는 중에 다시 눌러도 대기 시간이 줄지 않게 처음부터 센다
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      vibrate('done');
      progress.setValue(0);
      onComplete();
    });
  };

  const cancel = () => {
    Animated.timing(progress, {
      toValue: 0,
      duration: RELEASE_DURATION_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  return { progress, start, cancel };
}
