/** "주 목표 달성" 카드에 그릴 값: 최근 8주의 달성 여부와 연속 주 수. 한 주는 월요일 0시에 시작한다(앱과 같은 기준). */
import type { RunSummary } from './types';

const DAYS_PER_WEEK = 7;
/** 카드에 그리는 주의 수 */
export const SHOWN_WEEKS = 8;
/** 연속 주 수를 세려고 돌아보는 주의 수(이만큼의 러닝 목록을 읽는다) */
export const STREAK_LOOKBACK_WEEKS = 26;

/** 그 시각이 든 주의 월요일 0시(그 사람이 있는 곳의 시각) */
export function startOfWeek(time: number): number {
  const date = new Date(time);
  // getDay()는 0 = 일요일. 월요일을 0으로 바꾼다
  const sinceMonday = (date.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday).getTime();
}

/** n주 전(또는 뒤) 주의 월요일 0시. 서머타임이 있는 곳에서도 맞게 "날짜"로 옮긴다. */
function shiftWeeks(weekStart: number, weeks: number): number {
  const date = new Date(weekStart);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + weeks * DAYS_PER_WEEK).getTime();
}

/** 연속 주 수를 세는 데 필요한 가장 이른 시각(이보다 앞선 러닝은 읽지 않아도 된다) */
export function streakWindowStart(now: number): number {
  return shiftWeeks(startOfWeek(now), -(STREAK_LOOKBACK_WEEKS - 1));
}

export type WeekCell = {
  /** 그 주의 월요일 "11월 17일" */
  label: string;
  /** 칸에 마우스를 올리거나 읽어 줄 때의 글자 "11월 17일 주 · 3회" */
  title: string;
  count: number;
  met: boolean;
  isCurrent: boolean;
};

export type GoalWeeksView = {
  /** "6주 연속" / 연속이 없으면 "이번 주 2 / 3회" */
  headline: string;
  /** 오래된 주 → 이번 주 */
  cells: WeekCell[];
  /** "최근 8주 · 주 3회 목표" */
  caption: string;
};

function mondayLabel(weekStart: number): string {
  const date = new Date(weekStart);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 러닝 목록에서 주마다 인정된(10분 이상) 러닝 수를 세어 목표와 견준다.
 * 연속 주 수: 지난주부터 거슬러 올라가며 목표를 채운 주를 세고, 이번 주도 채웠으면 더한다
 * (이번 주를 아직 못 채웠다고 연속이 끊긴 것으로 보지 않는다 — 앱의 홈과 같은 규칙).
 * 지난 주들도 "지금의 주 목표"로 본다(Q-005 임시 처리).
 */
export function describeGoalWeeks(
  runs: readonly Pick<RunSummary, 'started_at' | 'counted'>[],
  weeklyGoal: number,
  now: number,
): GoalWeeksView {
  const thisWeek = startOfWeek(now);
  const counts = new Map<number, number>();
  for (const run of runs) {
    if (!run.counted) continue;
    const time = Date.parse(run.started_at);
    if (!Number.isFinite(time)) continue;
    const week = startOfWeek(time);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const countOf = (week: number) => counts.get(week) ?? 0;
  const met = (week: number) => countOf(week) >= weeklyGoal;

  let streak = 0;
  for (let back = 1; back < STREAK_LOOKBACK_WEEKS; back++) {
    if (!met(shiftWeeks(thisWeek, -back))) break;
    streak += 1;
  }
  if (met(thisWeek)) streak += 1;

  const cells: WeekCell[] = [];
  for (let back = SHOWN_WEEKS - 1; back >= 0; back--) {
    const week = shiftWeeks(thisWeek, -back);
    const label = mondayLabel(week);
    cells.push({ label, title: `${label} 주 · ${countOf(week)}회`, count: countOf(week), met: met(week), isCurrent: back === 0 });
  }

  return {
    headline: streak > 0 ? `${streak}주 연속` : `이번 주 ${countOf(thisWeek)} / ${weeklyGoal}회`,
    cells,
    caption: `최근 ${SHOWN_WEEKS}주 · 주 ${weeklyGoal}회 목표`,
  };
}
