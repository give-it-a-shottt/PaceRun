/**
 * 화면이 꺼져도 위치를 받는 백그라운드 위치 작업.
 * 안드로이드에서는 "러닝을 기록하고 있어요" 알림을 띄운 포그라운드 서비스로 돌아서,
 * 화면을 끄거나 다른 앱을 켜도 위치가 계속 들어온다.
 *
 * defineTask는 앱이 시작될 때(화면이 뜨기 전에도) 등록돼 있어야 하므로,
 * 이 파일은 루트 레이아웃에서 import만 해도 작업이 등록되게 맨 위에서 호출한다.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { LocationFix } from '@/domain/runEngine';

const TASK_NAME = 'pacerun-run-location';
const BRAND_COLOR = '#8E3B5A';

type Listener = (fixes: LocationFix[]) => void;

let listener: Listener | null = null;

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[runLocation] 위치 작업 오류', error.message);
    return;
  }
  const fixes = (data?.locations ?? []).map(toFix);
  if (fixes.length > 0) listener?.(fixes);
});

function toFix(location: Location.LocationObject): LocationFix {
  return {
    t: location.timestamp,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy,
  };
}

/** 위치가 들어올 때마다 불릴 함수를 정한다. 앱 프로세스가 다시 살아났을 때도 받을 수 있게 시작 전에 등록한다. */
export function setLocationListener(next: Listener | null): void {
  listener = next;
}

/** 위치 받기를 시작한다. 앱이 화면에 떠 있을 때만 시작할 수 있다(안드로이드 규칙). */
export async function startLocationUpdates(): Promise<void> {
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    foregroundService: {
      notificationTitle: 'Pace Run',
      notificationBody: '러닝을 기록하고 있어요',
      notificationColor: BRAND_COLOR,
    },
  });
}

export async function stopLocationUpdates(): Promise<void> {
  if (await isLocationRunning()) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}

/** 위치 받기가 아직 돌고 있는지(앱이 다시 켜졌을 때 러닝이 이어지고 있는지 판단) */
export async function isLocationRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  } catch {
    return false;
  }
}
