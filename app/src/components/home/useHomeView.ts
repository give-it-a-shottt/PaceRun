import { useCallback, useRef, useState } from 'react';

import { useRefreshOnFocus } from '@/components/useRefreshOnFocus';
import { loadHome, type HomeView } from '@/services/homeData';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * loading = 아직 그릴 값이 없음(처음 읽는 중이거나 실패 뒤 다시 읽는 중) / ready = 값이 있음 / failed = 읽지 못함.
 * 값이 있는 채로 다시 읽을 때는 ready에 머물러 이전 값을 그대로 보여 준다.
 */
export type HomeLoadState =
  | { status: 'loading'; view: null }
  | { status: 'ready'; view: HomeView }
  | { status: 'failed'; view: null };

/**
 * 홈에 그릴 값을 읽는다. 화면이 보일 때마다(탭으로 돌아오거나 앱으로 돌아올 때) 다시 읽어서,
 * 러닝을 끝내고 돌아오면 이번 주 칸과 오늘의 러닝 카드가 바뀐다.
 */
export function useHomeView() {
  const weeklyGoal = useSettingsStore((s) => s.settings.weeklyGoal);
  const [state, setState] = useState<HomeLoadState>({ status: 'loading', view: null });
  /** 요청 번호. 늦게 끝난 이전 요청이 새 값을 덮어쓰지 않게 가장 최근 요청의 결과만 받는다. */
  const latestRequest = useRef(0);

  const reload = useCallback(() => {
    const request = ++latestRequest.current;
    // 실패 안내는 다시 읽는 동안 내린다. 이미 보여 주던 값은 깜빡이지 않게 그대로 둔다.
    setState((previous) => (previous.status === 'failed' ? { status: 'loading', view: null } : previous));
    loadHome(Date.now(), weeklyGoal).then(
      (view) => {
        if (latestRequest.current === request) setState({ status: 'ready', view });
      },
      (error) => {
        console.warn('[home] 홈에 보여 줄 기록을 읽지 못했어요', error);
        // 예전 값을 남겨 두면 방금 끝낸 러닝이 빠진 화면을 맞는 것처럼 보여 주게 된다
        if (latestRequest.current === request) setState({ status: 'failed', view: null });
      },
    );
  }, [weeklyGoal]);

  // 화면이 보일 때 · 앱으로 돌아올 때 · 자정이 지날 때 다시 읽는다
  useRefreshOnFocus(reload);

  return { state, reload };
}
