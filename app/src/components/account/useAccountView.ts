import { useCallback, useState } from 'react';

import { useRefreshOnFocus } from '@/components/useRefreshOnFocus';
import { describeAccount, type AccountView } from '@/domain/syncView';
import { refreshLocalOnlyCount } from '@/services/sync';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * 계정 · 동기화 상태를 화면에 그릴 글자로 바꾼다(내 정보 탭 · 동기화 상태 화면이 함께 쓴다).
 * 로그인 · 동기화 상태는 store에서 바로 읽고, 폰에만 있는 기록 수와 "오늘"의 기준 시각은
 * 화면이 보일 때 · 앱으로 돌아올 때 · 자정이 지날 때 다시 맞춘다.
 */
export function useAccountView(): AccountView {
  const status = useAuthStore((s) => s.status);
  const email = useAuthStore((s) => s.email);
  const syncing = useAuthStore((s) => s.syncing);
  const problem = useAuthStore((s) => s.syncProblem);
  const localOnlyCount = useAuthStore((s) => s.localOnlyCount);
  const unsendableCount = useAuthStore((s) => s.unsendableCount);
  const lastSyncAt = useSettingsStore((s) => s.settings.lastSyncAt);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    setNow(Date.now());
    // 세지 못해도 던지지 않는다(이전 값이 그대로 남는다)
    void refreshLocalOnlyCount();
  }, []);
  useRefreshOnFocus(refresh);

  return describeAccount({ status, email, syncing, problem, localOnlyCount, unsendableCount, lastSyncAt, now });
}
