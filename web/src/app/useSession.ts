import { useSyncExternalStore } from 'react';

import { getSessionState, subscribeSession, type SessionState } from '../api/session';

/** 로그인 상태를 읽는다. 상태가 바뀌면(로그인 · 로그아웃 · 로그인이 풀림) 화면이 다시 그려진다. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSessionState);
}
