import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import { msUntilNextDay } from '@/domain/week';

/** 자정 정각에 읽으면 시계 오차로 아직 어제일 수 있어 조금 지나서 읽는다 */
const MIDNIGHT_MARGIN_MS = 2_000;

/**
 * "오늘"과 "이번 주"를 보여 주는 화면(홈 · 계획 · 기록)이 값을 다시 읽어야 하는 때에 reload를 부른다:
 * 화면이 보일 때(탭으로 돌아옴), 앱으로 돌아올 때, 화면을 켜 둔 채 자정이 지날 때(그때마다).
 * 화면이 보이지 않는 동안에는 부르지 않는다. reload는 바뀌지 않는 함수(useCallback)여야 한다.
 */
export function useRefreshOnFocus(reload: () => void): void {
  useFocusEffect(
    useCallback(() => {
      reload();
      const subscription = AppState.addEventListener('change', (appState) => {
        if (appState === 'active') reload();
      });
      let midnight: ReturnType<typeof setTimeout>;
      const waitForMidnight = () => {
        midnight = setTimeout(() => {
          reload();
          waitForMidnight();
        }, msUntilNextDay(Date.now()) + MIDNIGHT_MARGIN_MS);
      };
      waitForMidnight();
      return () => {
        subscription.remove();
        clearTimeout(midnight);
      };
    }, [reload]),
  );
}
