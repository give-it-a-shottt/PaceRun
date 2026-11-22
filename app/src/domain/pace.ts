/** 이 거리 이상 뛰어야 평균 페이스를 낸다(너무 짧으면 값이 튄다). */
export const AVG_PACE_MIN_DISTANCE_M = 50;

const KM = 1000;

/** 전체 평균 페이스(km당 초). 거리가 너무 짧으면 null */
export function averagePaceSecPerKm(elapsedMs: number, distanceM: number): number | null {
  if (distanceM < AVG_PACE_MIN_DISTANCE_M || elapsedMs <= 0) return null;
  return elapsedMs / 1000 / (distanceM / KM);
}
