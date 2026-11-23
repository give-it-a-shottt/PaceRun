import { useCallback, useRef, useState } from 'react';

import { useRefreshOnFocus } from '@/components/useRefreshOnFocus';
import { describeSettings, type NotificationAccess, type SettingsView } from '@/domain/settingsView';
import { getNotificationAccess } from '@/services/permissions';
import { useSettingsStore } from '@/state/settingsStore';

/**
 * 설정 화면에 그릴 값: 저장된 설정 + 폰의 알림 권한.
 * 설정은 store에서 바로 읽고(바꾸면 바로 반영된다), 알림 권한은 화면이 보일 때 · 앱으로 돌아올 때 다시 확인한다
 * — 폰 설정에서 권한을 켜고 돌아오면 "알림 권한이 꺼져 있어" 안내가 사라져야 한다.
 */
export function useSettingsView(): { view: SettingsView; recheckNotifications: () => void } {
  const settings = useSettingsStore((s) => s.settings);
  const [notifications, setNotifications] = useState<NotificationAccess>('unknown');
  /** 요청 번호. 늦게 끝난 이전 확인이 새 결과를 덮어쓰지 않게 가장 최근 확인의 결과만 받는다. */
  const latestRequest = useRef(0);

  const recheckNotifications = useCallback(() => {
    const request = ++latestRequest.current;
    // getNotificationAccess는 확인하지 못하면 'unknown'을 돌려주고 오류를 던지지 않는다
    void getNotificationAccess().then((access) => {
      if (latestRequest.current === request) setNotifications(access);
    });
  }, []);

  useRefreshOnFocus(recheckNotifications);

  return { view: describeSettings(settings, notifications), recheckNotifications };
}
