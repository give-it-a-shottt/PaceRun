import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { RunConfig } from '@/domain/types';
import { hasGoodGpsFix } from '@/services/gps';
import { getLocationAccess, requestLocationAccess, requestNotificationAccess } from '@/services/permissions';
import { useSettingsStore } from '@/state/settingsStore';

/** idle = 기다리는 중 / checking = 위치 권한 · 첫 GPS 확인 중 / searchingGps = GPS 신호를 못 잡아 되풀이해 찾는 중 */
export type StartPhase = 'idle' | 'checking' | 'searchingGps';

/** 시작을 막는 위치 문제. permission = 위치 권한 없음 / services = 폰의 위치(GPS)가 꺼짐 */
export type LocationIssue = 'permission' | 'services';

export type StartRequest = {
  config: RunConfig;
  planLabel: string | null;
  /** 시작 전 설정 시트에서 고른 값만 '마지막 설정'으로 기억한다([10분만 뛰기]는 기억하지 않는다). */
  remember: boolean;
  /** 카운트다운으로 넘어가기 직전에 부른다(시트 닫기). */
  onProceed?: () => void;
};

/** 처음에는 짧게 보고, 못 잡으면 [그냥 시작]을 내놓은 뒤 더 길게 되풀이해 찾는다 */
const FIRST_GPS_CHECK_MS = 3000;
const GPS_RETRY_GAP_MS = 2000;
/** 이만큼 되풀이해도 못 잡으면 그만 찾는다(약 2분). 안내와 [그냥 시작하기]는 그대로 남는다. */
const MAX_GPS_RETRIES = 18;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 러닝 시작 전 확인을 묶는다: 위치 권한 → GPS 신호 → 카운트다운 화면으로 이동.
 * 시작 전 설정 시트의 [시작]과 홈의 [10분만 뛰기]가 함께 쓴다.
 */
export function useStartRun() {
  const [phase, setPhase] = useState<StartPhase>('idle');
  const [locationIssue, setLocationIssue] = useState<LocationIssue | null>(null);
  const updateSetting = useSettingsStore((s) => s.update);
  /** 시도 번호. 취소하거나 넘어가면 올려서, 아직 돌고 있는 예전 확인의 결과를 버린다. */
  const attempt = useRef(0);
  /** 확인이 끝나기를 기다리는 요청. 있으면 [시작]을 다시 눌러도 새로 시작하지 않는다. */
  const waiting = useRef<StartRequest | null>(null);

  const stop = useCallback(() => {
    attempt.current += 1;
    waiting.current = null;
    setPhase('idle');
  }, []);

  const proceed = useCallback(
    (request: StartRequest) => {
      stop();
      if (request.remember) void updateSetting('lastRunConfig', request.config);
      request.onProceed?.();
      // 러닝 화면들은 홈 위에 쌓지 않고 바꿔 넣는다(끝나고 홈으로 돌아올 때 홈이 겹쳐 쌓이지 않게)
      router.replace({
        pathname: '/run/countdown',
        params: {
          config: JSON.stringify(request.config),
          ...(request.planLabel ? { planLabel: request.planLabel } : null),
        },
      });
    },
    [stop, updateSetting],
  );

  const start = useCallback(
    async (request: StartRequest) => {
      if (waiting.current) return;
      const id = ++attempt.current;
      const cancelled = () => attempt.current !== id;
      waiting.current = request;
      setPhase('checking');

      try {
        let access = await getLocationAccess();
        if (!access.foreground) access = await requestLocationAccess();
        if (cancelled()) return;
        if (!access.foreground || !access.servicesEnabled) {
          stop();
          setLocationIssue(access.foreground ? 'services' : 'permission');
          return;
        }

        // 잠금화면의 [일시정지] 버튼은 알림 권한이 있어야 뜬다. 거절해도 러닝은 시작할 수 있다.
        await requestNotificationAccess().catch(() => false);
        if (cancelled()) return;

        let found = await hasGoodGpsFix(FIRST_GPS_CHECK_MS);
        if (cancelled()) return;
        if (!found) setPhase('searchingGps');
        for (let retry = 0; !found && retry < MAX_GPS_RETRIES; retry++) {
          await wait(GPS_RETRY_GAP_MS);
          if (cancelled()) return;
          found = await hasGoodGpsFix();
          if (cancelled()) return;
        }
        // 끝내 못 잡았으면 여기서 멈춘다. 화면에는 안내와 [그냥 시작하기]가 남아 있다.
        if (found) proceed(request);
      } catch (error) {
        console.warn('[useStartRun] 위치 상태를 확인하지 못했어요', error);
        if (cancelled()) return;
        stop();
        // 토스트는 시트(Modal) 뒤에 가려지므로, 위치를 확인할 수 없을 때도 권한 안내 창으로 알린다
        setLocationIssue('permission');
      }
    },
    [proceed, stop],
  );

  /** GPS 신호를 기다리지 않고 바로 카운트다운으로 간다([그냥 시작하기]). */
  const startAnyway = useCallback(() => {
    if (waiting.current) proceed(waiting.current);
  }, [proceed]);

  const dismissLocationIssue = useCallback(() => setLocationIssue(null), []);

  // 화면(시트)이 사라지면 돌고 있던 GPS 확인을 멈춘다
  useEffect(() => stop, [stop]);

  return {
    phase,
    /** 확인 중이라 [시작]을 다시 누를 수 없는 상태 */
    busy: phase !== 'idle',
    start,
    startAnyway,
    /** 진행 중인 확인을 그만둔다(시트를 닫거나 설정을 바꿨을 때). */
    cancel: stop,
    locationIssue,
    dismissLocationIssue,
  };
}
