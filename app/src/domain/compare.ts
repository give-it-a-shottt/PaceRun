/** "지난번 비교" 한 줄과, 비교할 지난 기록 찾기. 홈의 오늘의 러닝 카드 · 완료 요약 · 러닝 상세가 같은 문장을 쓴다. */
import { formatPace } from './format';
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

/**
 * 기준 시각(startedAt)보다 앞선, 같은 모드이고 평균 페이스가 있는 가장 최근 기록.
 * 10분을 못 채운 기록(counted가 아님)은 기준으로 삼지 않는다 — 시작하자마자 끝낸 기록 하나가 다음 비교를 흐리지 않게(Q-012).
 */
export function previousComparable<T extends ComparableRun & { counted: boolean }>(
  current: Pick<ComparableRun, 'mode' | 'startedAt'>,
  runs: readonly T[],
): T | null {
  let found: T | null = null;
  for (const run of runs) {
    if (!run.counted || run.mode !== current.mode || run.avgPaceSecPerKm == null || run.startedAt >= current.startedAt) continue;
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
  if (faster > 0) return `지난번보다 페이스가 ${gapText(faster)} 빨라졌어요`;
  if (faster < 0) return `지난번보다 ${gapText(-faster)} 천천히 뛰었어요`;
  return '지난번과 같은 페이스로 뛰었어요';
}

/** 페이스 차이(초): "8초" · "1분" · "4분 33초" */
function gapText(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const rest = seconds % 60;
  return rest === 0 ? `${Math.floor(seconds / 60)}분` : `${Math.floor(seconds / 60)}분 ${rest}초`;
}

/** 지난번 비교 상자에 그릴 값(완료 요약 · 러닝 상세) */
export type ComparisonView = {
  /** "지난번보다 페이스가 8초 빨라졌어요" / "첫 인터벌 기록이에요" */
  text: string;
  /** `같은 인터벌 기준 · 6'10" → 6'02"`. 비교할 지난 기록이 없으면 null */
  detail: string | null;
};

/** 같은 모드 지난 기록과의 비교. 이번 페이스를 알 수 없어 비교할 수 없으면 null */
export function describeComparison(current: ComparableRun, previous: ComparableRun | null): ComparisonView | null {
  const text = comparePace(current, previous);
  if (!text) return null;
  const comparable = previous?.avgPaceSecPerKm != null && current.avgPaceSecPerKm != null;
  return {
    text,
    detail: comparable
      ? `같은 ${MODE_NOUN[current.mode]} 기준 · ${formatPace(previous.avgPaceSecPerKm)} → ${formatPace(current.avgPaceSecPerKm)}`
      : null,
  };
}
