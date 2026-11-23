import { create } from 'zustand';

import type { AccountStatus, SyncProblem } from '@/domain/syncView';

export type { AccountStatus, SyncProblem } from '@/domain/syncView';

type AuthState = {
  status: AccountStatus;
  /** 로그인한(또는 만료된) 계정의 이메일 */
  email: string | null;
  /** 동기화가 돌고 있는지 */
  syncing: boolean;
  /** 마지막 동기화의 문제. 잘 끝났거나 아직 돌린 적 없으면 null */
  syncProblem: SyncProblem | null;
  /** 폰에만 있는 끝난 러닝 수(아직 서버에 올라가지 않음). 아직 세지 않았으면 null */
  localOnlyCount: number | null;
  /** 그중 서버가 받지 않아 올릴 수 없는 러닝 수(24시간 · 300km 초과 등) */
  unsendableCount: number;
};

/** 로그인 상태와 동기화 상태. 바꾸는 것은 서비스(session · sync)이고 화면은 읽기만 한다. */
export const useAuthStore = create<AuthState>(() => ({
  status: 'loading',
  email: null,
  syncing: false,
  syncProblem: null,
  localOnlyCount: null,
  unsendableCount: 0,
}));
