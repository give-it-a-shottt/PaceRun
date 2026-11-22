import { create } from 'zustand';

import type { RunState } from '@/domain/runEngine';

type RunStoreState = {
  /** 진행 중인 러닝의 계산 상태. 러닝 중이 아니면 null */
  run: RunState | null;
  /**
   * 화면을 1초마다 다시 그리게 하는 "지금 시각". 경과 시간은 저장하지 않고
   * 화면이 `elapsedMs(run, now)`로 그때그때 계산한다(D-005).
   */
  now: number;
  /** 저장이 연달아 실패하고 있으면 화면에 알린다 */
  saveFailing: boolean;
};

/** 러닝 화면이 구독하는 상태. 값은 services/runController만 바꾼다. */
export const useRunStore = create<RunStoreState>(() => ({
  run: null,
  now: Date.now(),
  saveFailing: false,
}));
