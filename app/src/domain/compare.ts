/** "지난번 비교" 한 줄. 홈의 오늘 완료 카드, 완료 요약, 러닝 상세가 함께 쓴다. */
import type { RunMode } from './types';

/** 비교에 필요한 만큼의 러닝 정보 */
export type ComparableRun = { mode: RunMode; startedAt: number; avgPaceSecPerKm: number | null };

/** 문장 속에 넣는 모드 이름("첫 인터벌 기록이에요") */
const MODE_NOUN: Record<RunMode, string> = {
  free: '자유 러닝',
  interval: '인터벌',
  cadence: '발걸음 박자',
  pacemaker: '페이스메이커',
};

/** current보다 앞선, 같은 모드이고 평균 페이스가 있는 가장 최근 기록 */
export function previousComparable<T extends ComparableRun>(current: ComparableRun, runs: readonly T[]): T | null {
  let found: T | null = null;
  for (const run of runs) {
    if (run.mode !== current.mode || run.avgPaceSecPerKm == null || run.startedAt >= current.startedAt) continue;
    if (!found || run.startedAt > found.startedAt) found = run;
  }
  return found;
}

/**
 * 같은 모드 지난 기록과의 페이스 비교 한 줄.
 * - 지난 기록이 없으면 "첫 인터벌 기록이에요"
 * - 이번 기록의 페이스를 알 수 없으면(거리가 너무 짧음) null — 줄을 숨긴다
 */
export function comparePace(current: ComparableRun, previous: ComparableRun | null): string | null {
  if (!previous || previous.avgPaceSecPerKm == null) return `첫 ${MODE_NOUN[current.mode]} 기록이에요`;
  if (current.avgPaceSecPerKm == null) return null;

  // 페이스는 km당 초라서 값이 작을수록 빠르다
  const faster = Math.round(previous.avgPaceSecPerKm - current.avgPaceSecPerKm);
  if (faster > 0) return `지난번보다 페이스가 ${faster}초 빨라졌어요`;
  if (faster < 0) return `지난번보다 ${-faster}초 천천히 뛰었어요`;
  return '지난번과 같은 페이스로 뛰었어요';
}
