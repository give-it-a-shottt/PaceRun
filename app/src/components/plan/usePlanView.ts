import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadPlan, type PlanView } from '@/services/planData';

/**
 * loading = 아직 그릴 값이 없음(처음 읽는 중이거나 실패 뒤 다시 읽는 중) / ready = 값이 있음 / failed = 읽지 못함.
 * 값이 있는 채로 다시 읽을 때는 ready에 머물러 이전 값을 그대로 보여 준다.
 */
export type PlanLoadState =
  | { status: 'loading'; view: null }
  | { status: 'ready'; view: PlanView }
  | { status: 'failed'; view: null };

/**
 * 계획 탭에 그릴 값을 읽는다. 화면이 보일 때마다(탭으로 돌아오거나 템플릿을 적용하고 돌아올 때) 다시 읽고,
 * 운동을 저장 · 삭제한 뒤에는 화면이 reload를 부른다.
 */
export function usePlanView() {
  const [state, setState] = useState<PlanLoadState>({ status: 'loading', view: null });
  /** 요청 번호. 늦게 끝난 이전 요청이 새 값을 덮어쓰지 않게 가장 최근 요청의 결과만 받는다. */
  const latestRequest = useRef(0);

  const reload = useCallback(() => {
    const request = ++latestRequest.current;
    // 실패 안내는 다시 읽는 동안 내린다. 이미 보여 주던 값은 깜빡이지 않게 그대로 둔다.
    setState((previous) => (previous.status === 'failed' ? { status: 'loading', view: null } : previous));
    loadPlan(Date.now()).then(
      (view) => {
        if (latestRequest.current === request) setState({ status: 'ready', view });
      },
      (error) => {
        console.warn('[plan] 계획을 읽지 못했어요', error);
        // 예전 값을 남겨 두면 방금 바꾼 운동이 빠진 화면을 맞는 것처럼 보여 주게 된다
        if (latestRequest.current === request) setState({ status: 'failed', view: null });
      },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      // 앱을 켜 둔 채 날짜가 바뀌면 '오늘'과 이번 주가 달라지므로 앱으로 돌아올 때도 다시 읽는다
      const subscription = AppState.addEventListener('change', (appState) => {
        if (appState === 'active') reload();
      });
      return () => subscription.remove();
    }, [reload]),
  );

  return { state, reload };
}
