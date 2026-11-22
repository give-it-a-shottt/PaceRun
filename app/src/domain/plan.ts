/**
 * 주간 계획(매주 되풀이되는 요일별 운동)의 계산: 계획 탭에 그릴 값, 템플릿, 고치기.
 * 계획은 요일당 운동 1개이고, 한 주는 월요일에 시작한다.
 */
import { nextSession, parsePlanLabel, type FinishedRun } from './home';
import { describeConfig, estimatedDurationSec } from './runConfig';
import { MODE_LABEL } from './runView';
import type { PlanItem, RunConfig, RunMode } from './types';
import { addDays, DAYS_PER_WEEK, isSameDay, startOfWeek, WEEKDAY_LABELS, WEEKDAY_NAMES, weekdayIndex } from './week';

/**
 * done = 그날 이 계획으로 뛰었음 / today = 오늘 할 것 / upcoming = 이번 주에 남은 것 /
 * past = 지나갔고 뛰지 않음(따로 탓하지 않고 이름만 보여 준다)
 */
export type PlanWorkoutStatus = 'done' | 'today' | 'upcoming' | 'past';

export type PlanDayView = {
  weekday: number;
  /** "월" */
  label: string;
  /** 그 주의 날짜 "17" */
  dateText: string;
  isToday: boolean;
  /** 그 요일의 운동. 없으면 null(운동 추가 칸을 그린다) */
  workout: {
    mode: RunMode;
    /** "인터벌 입문 3회차". 지나간 날은 회차 없이 "인터벌 입문" */
    title: string;
    /** "1분 달리기 + 1분 30초 걷기 × 8" */
    description: string;
    status: PlanWorkoutStatus;
    config: RunConfig;
  } | null;
  /** 화면을 읽어 주는 기능용: "목요일, 오늘, 인터벌 입문 3회차" / "금요일, 운동 없음" */
  accessibilityLabel: string;
};

export type PlanView = {
  /** "11월 17일 – 23일" */
  rangeText: string;
  /** "주 3회 · 약 60분". 계획이 없으면 "주 0회" */
  summaryText: string;
  days: PlanDayView[];
  /** 계획이 하나도 없음(빈 상태 화면) */
  isEmpty: boolean;
  /** [+]를 눌렀을 때 운동을 추가할 요일: 오늘부터 찾은 첫 빈 요일. 모두 차 있으면 null */
  nextEmptyWeekday: number | null;
};

export type PlanTemplate = {
  id: string;
  title: string;
  /** "주 3회 · 1분 달리기 + 1분 30초 걷기 × 8" */
  summary: string;
  items: PlanItem[];
};

/** 템플릿 카드의 요일 배치 미리보기 한 칸 */
export type TemplateDayView = { label: string; mode: RunMode | null };

const INTERVAL_INTRO: RunConfig = { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 };
const CADENCE_PRACTICE: RunConfig = { mode: 'cadence', spm: 170, durationSec: 20 * 60 };
const PACE_KEEP: RunConfig = { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 };

const LABEL_INTERVAL = '인터벌 입문';
const LABEL_CADENCE = '발걸음 박자 연습';
const LABEL_PACE = '페이스 유지';

function item(weekday: number, config: RunConfig, label: string): PlanItem {
  return { weekday, mode: config.mode, config, label };
}

/** 템플릿 4개(pacerun-design.md 0-4 "템플릿(제안값)", 요일 배치는 피그마 PLN_01_003) */
export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  {
    id: 'interval-intro',
    title: LABEL_INTERVAL,
    summary: '주 3회 · 1분 달리기 + 1분 30초 걷기 × 8',
    items: [0, 3, 5].map((weekday) => item(weekday, INTERVAL_INTRO, LABEL_INTERVAL)),
  },
  {
    id: 'cadence-practice',
    title: LABEL_CADENCE,
    summary: '주 3회 · 20분, 분당 170걸음',
    items: [0, 2, 5].map((weekday) => item(weekday, CADENCE_PRACTICE, LABEL_CADENCE)),
  },
  {
    id: 'pace-keep',
    title: LABEL_PACE,
    summary: '주 3회 · 3km, 목표 ±10초',
    items: [1, 3, 6].map((weekday) => item(weekday, PACE_KEEP, LABEL_PACE)),
  },
  {
    id: 'mixed',
    title: '혼합',
    summary: '주 3회 · 월 인터벌 · 수 박자 · 토 페이스',
    items: [item(0, INTERVAL_INTRO, LABEL_INTERVAL), item(2, CADENCE_PRACTICE, LABEL_CADENCE), item(5, PACE_KEEP, LABEL_PACE)],
  },
];

/** 템플릿의 요일 배치(월~일 7칸). 운동이 있는 칸에는 그 모드를 담는다. */
export function templateDays(template: PlanTemplate): TemplateDayView[] {
  return WEEKDAY_LABELS.map((label, weekday) => ({
    label,
    mode: template.items.find((candidate) => candidate.weekday === weekday)?.mode ?? null,
  }));
}

/** 직접 추가한 운동의 이름. 모드를 그대로 두고 목표값만 고치면 원래 이름(예: 템플릿의 "인터벌 입문")을 지킨다. */
export function workoutLabel(mode: RunMode, previous: PlanItem | null): string {
  return previous && previous.mode === mode ? previous.label : MODE_LABEL[mode];
}

/** 그 요일의 운동을 넣거나 바꾼 새 계획(요일 순) */
export function withWorkout(plan: readonly PlanItem[], weekday: number, config: RunConfig): PlanItem[] {
  const previous = plan.find((candidate) => candidate.weekday === weekday) ?? null;
  const next: PlanItem = { weekday, mode: config.mode, config, label: workoutLabel(config.mode, previous) };
  return [...plan.filter((candidate) => candidate.weekday !== weekday), next].sort((a, b) => a.weekday - b.weekday);
}

/** 그 요일을 비운 새 계획 */
export function withoutWorkout(plan: readonly PlanItem[], weekday: number): PlanItem[] {
  return plan.filter((candidate) => candidate.weekday !== weekday);
}

/** 바텀시트 제목: "금요일에 운동 추가" / "금요일 운동 바꾸기" */
export function workoutSheetTitle(weekday: number, editing: boolean): string {
  return editing ? `${WEEKDAY_NAMES[weekday]} 운동 바꾸기` : `${WEEKDAY_NAMES[weekday]}에 운동 추가`;
}

export type PlanInput = { now: number; plan: readonly PlanItem[]; runs: readonly FinishedRun[] };

export function describePlan({ now, plan, runs }: PlanInput): PlanView {
  const weekStart = startOfWeek(now);
  const today = weekdayIndex(now);
  /** 이름별로 이번 주에 이미 매긴 회차 수(오늘 이후의 날에 차례로 번호를 준다) */
  const assigned = new Map<string, number>();

  const days = WEEKDAY_LABELS.map((label, weekday): PlanDayView => {
    const day = addDays(weekStart, weekday);
    const isToday = weekday === today;
    const planned = plan.find((candidate) => candidate.weekday === weekday);
    const names = [WEEKDAY_NAMES[weekday], ...(isToday ? ['오늘'] : [])];
    const base = { weekday, label, dateText: String(new Date(day).getDate()), isToday };
    if (!planned) return { ...base, workout: null, accessibilityLabel: [...names, '운동 없음'].join(', ') };

    const done = runs.find(
      (run) => run.counted && isSameDay(run.startedAt, day) && parsePlanLabel(run.planLabel)?.base === planned.label,
    );
    let title: string;
    let status: PlanWorkoutStatus;
    if (done) {
      title = done.planLabel ?? planned.label;
      status = 'done';
    } else if (weekday < today) {
      title = planned.label;
      status = 'past';
    } else {
      const ahead = assigned.get(planned.label) ?? 0;
      assigned.set(planned.label, ahead + 1);
      title = `${planned.label} ${nextSession(planned.label, runs) + ahead}회차`;
      status = isToday ? 'today' : 'upcoming';
    }

    return {
      ...base,
      workout: { mode: planned.mode, title, description: describeConfig(planned.config), status, config: planned.config },
      accessibilityLabel: [...names, title, ...(status === 'done' ? ['완료'] : [])].join(', '),
    };
  });

  return {
    rangeText: rangeText(weekStart),
    summaryText: summaryText(plan),
    days,
    isEmpty: plan.length === 0,
    nextEmptyWeekday: nextEmptyWeekday(plan, today),
  };
}

/** "11월 17일 – 23일". 주가 두 달에 걸치면 "11월 30일 – 12월 6일" */
function rangeText(weekStart: number): string {
  const first = new Date(weekStart);
  const last = new Date(addDays(weekStart, DAYS_PER_WEEK - 1));
  const end = first.getMonth() === last.getMonth() ? `${last.getDate()}일` : `${last.getMonth() + 1}월 ${last.getDate()}일`;
  return `${first.getMonth() + 1}월 ${first.getDate()}일 – ${end}`;
}

/** "주 3회 · 약 60분". 시간 제한 없는 자유 러닝이 섞여 있으면 합계를 알 수 없어 횟수만 보여 준다. */
function summaryText(plan: readonly PlanItem[]): string {
  const count = `주 ${plan.length}회`;
  let totalSec = 0;
  for (const planned of plan) {
    const sec = estimatedDurationSec(planned.config);
    if (sec == null) return count;
    totalSec += sec;
  }
  return plan.length === 0 ? count : `${count} · 약 ${Math.max(1, Math.round(totalSec / 60))}분`;
}

/** 오늘부터 일요일까지, 없으면 월요일부터 다시 찾은 첫 빈 요일 */
function nextEmptyWeekday(plan: readonly PlanItem[], today: number): number | null {
  for (let ahead = 0; ahead < DAYS_PER_WEEK; ahead++) {
    const weekday = (today + ahead) % DAYS_PER_WEEK;
    if (!plan.some((candidate) => candidate.weekday === weekday)) return weekday;
  }
  return null;
}
