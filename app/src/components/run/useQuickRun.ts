import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { QUICK_RUN_CONFIG, QUICK_RUN_LABEL } from '@/domain/runConfig';

import { useStartRun } from './useStartRun';

type Options = {
  /**
   * 시작해도 되는지 먼저 확인한다. false를 돌려주면 시작하지 않는다
   * (홈: 끝나지 않은 러닝이 있으면 복구 창부터 띄운다 / 기록 탭 빈 상태: 홈으로 보내 복구 창을 띄운다).
   */
  canStart?: () => boolean | Promise<boolean>;
};

/**
 * [10분만 뛰기]: 설정 시트를 거치지 않고 바로 시작한다(위치 권한 → GPS 신호 → 카운트다운).
 * 홈과 기록 탭의 빈 상태가 함께 쓴다. 화면에는 QuickRunFeedback의 부품으로 GPS 안내 · 위치 문제를 보여 준다.
 */
export function useQuickRun({ canStart }: Options = {}) {
  const { phase, busy, start: startRun, startAnyway, cancel, locationIssue, dismissLocationIssue } = useStartRun();

  useFocusEffect(
    useCallback(() => {
      // 다른 탭으로 가면 GPS 확인을 멈춘다
      return () => cancel();
    }, [cancel]),
  );

  const start = async () => {
    if (canStart && !(await canStart())) return;
    // 시트를 거치지 않으므로 '마지막 설정'은 바꾸지 않는다
    void startRun({ config: QUICK_RUN_CONFIG, planLabel: QUICK_RUN_LABEL, remember: false });
  };

  return {
    start,
    /** 확인 중이라 다시 누를 수 없는 상태 */
    busy,
    /** GPS 신호를 못 잡아 되풀이해 찾는 중(안내와 [그냥 시작하기] · [취소]를 보여 준다) */
    searchingGps: phase === 'searchingGps',
    startAnyway,
    cancel,
    locationIssue,
    dismissLocationIssue,
  };
}

export type QuickRun = ReturnType<typeof useQuickRun>;
