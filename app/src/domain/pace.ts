/** 이 거리 이상 뛰어야 평균 페이스를 낸다(너무 짧으면 값이 튄다). */
export const AVG_PACE_MIN_DISTANCE_M = 50;

const KM = 1000;

/** 전체 평균 페이스(km당 초). 거리가 너무 짧으면 null */
export function averagePaceSecPerKm(elapsedMs: number, distanceM: number): number | null {
  if (distanceM < AVG_PACE_MIN_DISTANCE_M || elapsedMs <= 0) return null;
  return elapsedMs / 1000 / (distanceM / KM);
}

/** 최근 페이스를 낼 때 쓰는 표본: 그 시점의 경과 시간과 누적 거리 */
export type PaceSample = { elapsedMs: number; distanceM: number };

/** 표본이 이만큼의 시간에 걸쳐 있어야 최근 페이스를 낸다 */
export const PACE_MIN_SPAN_MS = 20_000;

/** 최근 표본들로 낸 "지금 페이스"(km당 초). 표본이 모자라거나 움직이지 않았으면 null */
export function recentPaceSecPerKm(samples: readonly PaceSample[]): number | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const spanMs = last.elapsedMs - first.elapsedMs;
  const moved = last.distanceM - first.distanceM;
  if (spanMs < PACE_MIN_SPAN_MS || moved <= 0) return null;
  return spanMs / 1000 / (moved / KM);
}

/** 페이스메이커: 목표 페이스에서 이만큼(km당 초)까지는 벗어난 것으로 보지 않는다 */
export const PACE_TOLERANCE_SEC = 10;

/** 목표보다 얼마나 느린지(km당 초). 양수 = 느림, 음수 = 빠름. 최근 페이스를 알 수 없으면 null */
export function paceGapSec(samples: readonly PaceSample[], targetPaceSecPerKm: number): number | null {
  const current = recentPaceSecPerKm(samples);
  return current == null ? null : current - targetPaceSecPerKm;
}
