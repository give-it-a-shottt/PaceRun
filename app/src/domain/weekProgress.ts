/**
 * 꾸준함 장치의 계산: 이번 주 횟수, 주간 칸 7개, 주 연속.
 * 하루를 빠져도 끊기지 않는다. "주 목표를 채운 주"가 이어지는 수를 센다(pacerun-design.md 0-3).
 */
import { addDays, DAYS_PER_WEEK, isSameDay, startOfWeek, WEEKDAY_LABELS, WEEKDAY_NAMES, weekdayIndex } from './week';

/** 횟수 계산에 필요한 만큼의 러닝 정보 */
export type RunMark = { startedAt: number; counted: boolean };

export type WeekCellState = 'done' | 'today' | 'planned' | 'rest';

export type WeekCellView = {
  /** "월" */
  label: string;
  /** done = 그날 인정된 러닝이 있음 / today = 오늘(아직 안 뜀) / planned = 앞으로 올 계획 있는 날 / rest = 그 밖 */
  state: WeekCellState;
  isToday: boolean;
  /** 화면을 읽어 주는 기능용: "토요일, 계획 있음" */
  accessibilityLabel: string;
};

export type WeekProgress = {
  /** 이번 주에 인정된 러닝 수 */
  count: number;
  goal: number;
  met: boolean;
  /** 지난주부터 거슬러 올라가며 목표를 채운 주가 이어진 수(이번 주 제외) */
  previousStreak: number;
  /** 이번 주가 목표를 채웠으면 이번 주까지 넣은 수, 아니면 previousStreak */
  streak: number;
};

const CELL_STATE_NAMES: Record<WeekCellState, string> = {
  done: '완료',
  today: '아직 뛰지 않음',
  planned: '계획 있음',
  rest: '쉼',
};

/** 그 주(월요일 0시 시작)에 인정된 러닝 수 */
export function countedInWeek(runs: readonly RunMark[], weekStart: number): number {
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK);
  return runs.filter((run) => run.counted && run.startedAt >= weekStart && run.startedAt < weekEnd).length;
}

/**
 * 이번 주 진행과 주 연속.
 * 지난 주들도 "지금의 주 목표"로 따진다(주마다 목표를 따로 저장하지 않는다 — 서버 통계와 같은 기준, Q-005).
 */
export function weekProgress(runs: readonly RunMark[], weeklyGoal: number, now: number): WeekProgress {
  const thisWeek = startOfWeek(now);
  // 러닝을 한 번만 훑어 주(월요일 0시)별 인정 횟수를 센다. 주마다 전체를 다시 훑지 않는다.
  const perWeek = new Map<number, number>();
  for (const run of runs) {
    if (!run.counted) continue;
    const week = startOfWeek(run.startedAt);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }
  const count = perWeek.get(thisWeek) ?? 0;
  const met = count >= weeklyGoal;

  // 지난주부터 거슬러 올라가며 목표를 채운 주를 센다. 못 채운 주(기록이 없는 주 포함)에서 멈춘다.
  let previousStreak = 0;
  for (let week = addDays(thisWeek, -DAYS_PER_WEEK); (perWeek.get(week) ?? 0) >= weeklyGoal; week = addDays(week, -DAYS_PER_WEEK)) {
    previousStreak += 1;
  }

  return { count, goal: weeklyGoal, met, previousStreak, streak: previousStreak + (met ? 1 : 0) };
}

/** 주 연속 한 줄. 이어 온 것이 없으면 null(줄을 숨긴다). */
export function streakText(progress: WeekProgress): string | null {
  if (progress.met) {
    return progress.streak >= 2 ? `${progress.streak}주 연속 목표 달성!` : '이번 주 목표 달성!';
  }
  if (progress.previousStreak >= 2) return `${progress.previousStreak}주 연속 목표 달성 중`;
  if (progress.previousStreak === 1) return '지난주 목표 달성 · 이번 주도 이어 가요';
  return null;
}

/**
 * 이번 주 칸 7개(월~일).
 * 지나간 날은 뛰었으면 완료, 아니면 쉼으로만 보인다 — 계획을 못 지킨 날을 따로 표시해 탓하지 않는다.
 */
export function weekCells(
  runs: readonly RunMark[],
  plannedWeekdays: ReadonlySet<number>,
  now: number,
): WeekCellView[] {
  const weekStart = startOfWeek(now);
  const todayIndex = weekdayIndex(now);

  return WEEKDAY_LABELS.map((label, index) => {
    const day = addDays(weekStart, index);
    const isToday = index === todayIndex;
    const done = runs.some((run) => run.counted && isSameDay(run.startedAt, day));
    const state: WeekCellState = done
      ? 'done'
      : isToday
        ? 'today'
        : index > todayIndex && plannedWeekdays.has(index)
          ? 'planned'
          : 'rest';
    const parts = [WEEKDAY_NAMES[index], ...(isToday ? ['오늘'] : []), CELL_STATE_NAMES[state]];
    return { label, state, isToday, accessibilityLabel: parts.join(', ') };
  });
}
