import * as Location from 'expo-location';

import { MAX_ACCURACY_M } from '@/domain/runEngine';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * 시작 전에 쓸 만한 GPS 신호가 잡히는지 본다(RUN_02_001 "GPS 신호를 찾는 중").
 * 정해진 시간 안에 거리 계산에 쓸 수 있는 정확도의 위치를 받으면 true.
 * 위치 권한이 없거나 오류가 나면 false를 돌려준다(시작을 막을지는 화면이 정한다).
 */
export async function hasGoodGpsFix(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
      timeout,
    ]);
    if (!position) return false;
    const accuracy = position.coords.accuracy;
    return accuracy == null || accuracy <= MAX_ACCURACY_M;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
