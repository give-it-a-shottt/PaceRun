/**
 * 홈 화면에 그릴 값. 화면은 이 결과를 그리기만 한다.
 * 오늘의 러닝 카드는 네 가지다(pacerun-design.md 0-5 Flow A):
 * 오늘 계획 있음 / 계획이 아예 없음 → "자유 20분" / 쉬는 요일 → "가볍게 10분" / 오늘 이미 뜀 → 완료 표시
 */
import { comparePace, previousComparable } from './compare';
import { formatDistanceKm, formatDuration, formatPace } from './format';
import { describeConfig, describeEstimate } from './runConfig';
import { MODE_LABEL } from './runView';
import type { PlanItem, RunConfig, RunMode } from './types';
import { DAYS_PER_WEEK, isSameDay, WEEKDAY_NAMES, weekdayIndex, weekLabel } from './week';
import { streakText, weekCells, weekProgress, type WeekCellView } from './weekProgress';

/** 홈 계산에 필요한 만큼의 끝난 러닝 정보 */
export type FinishedRun = {
  id: string;
  mode: RunMode;
  planLabel: string | null;
  startedAt: number;
  elapsedMs: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
  counted: boolean;
};

export type TodayCard =
  | {
      kind: 'planned';
      mode: RunMode;
      /** "인터벌 입문 3회차" */
      title: string;
      /** "1분 달리기 + 1분 30초 걷기 × 8" */
      description: string;
      /** "약 20분". 시간 제한 없는 자유 러닝이면 null */
      estimate: string | null;
      /** 같은 모드 지난 기록의 평균 페이스 `지난번 6'05"/km`. 없으면 null */
      lastPaceText: string | null;
      /** '왜 오늘 이걸' 한 줄 */
      reason: string;
      /** [시작]을 누르면 시작 전 설정에 미리 채울 값 */
      config: RunConfig;
      planLabel: string;
    }
  | { kind: 'noPlan'; mode: 'free'; title: string; message: string; startLabel: string; config: RunConfig }
  | { kind: 'restDay'; mode: 'free'; title: string; message: string }
  | {
      kind: 'done';
      runId: string;
      mode: RunMode;
      title: string;
      /** `3.12 km · 20:14 · 평균 6'02"/km` */
      stats: string;
      /** 지난번 비교 한 줄. 비교할 수 없으면 null */
      comparison: string | null;
    };

export type HomeView = {
  /** "11월 4주차" */
  weekLabel: string;
  /** "이번 주 2 / 3회", 목표를 채우면 "이번 주 3 / 3회 · 목표 달성" */
  title: string;
  cells: WeekCellView[];
  /** "3주 연속 목표 달성 중". 이어 온 것이 없으면 null */
  streakText: string | null;
  today: TodayCard;
};

export type HomeInput = {
  now: number;
  weeklyGoal: number;
  plan: readonly PlanItem[];
  /** 끝난 러닝 전체(순서 무관). 주 연속 · 회차 · 지난번 비교에 쓴다. */
  runs: readonly FinishedRun[];
};

/** 계획이 없는 날 권하는 운동 */
export const NO_PLAN_CONFIG: RunConfig = { mode: 'free', targetDurationSec: 20 * 60 };

/** '왜 오늘 이걸' 한 줄. 모드마다 하나씩 */
const REASONS: Record<RunMode, string> = {
  interval: '걷기에서 숨을 고르면 막판이 덜 처져요',
  cadence: '박자에 발을 맞추면 보폭이 고르게 돼요',
  pacemaker: '같은 속도로 끝까지 가는 연습이에요',
  free: '편한 속도로, 숨이 차지 않을 만큼만 뛰어요',
};

const SESSION_PATTERN = /^(.*) (\d+)회차$/;

/** "인터벌 입문 3회차" → { base: "인터벌 입문", session: 3 }. 회차가 붙지 않은 이름이면 null */
export function parsePlanLabel(planLabel: string | null): { base: string; session: number } | null {
  const match = planLabel ? SESSION_PATTERN.exec(planLabel) : null;
  return match ? { base: match[1], session: Number(match[2]) } : null;
}

/**
 * 이 계획의 다음 회차. 인정된 기록 가운데 같은 이름의 가장 큰 회차 + 1.
 * 개수를 세지 않고 가장 큰 번호를 쓰는 것은, 기록을 지워도 번호가 거꾸로 가지 않게 하려는 것.
 */
export function nextSession(label: string, runs: readonly FinishedRun[]): number {
  let last = 0;
  for (const run of runs) {
    if (!run.counted) continue;
    const parsed = parsePlanLabel(run.planLabel);
    if (parsed && parsed.base === label) last = Math.max(last, parsed.session);
  }
  return last + 1;
}

/** 계획 한 칸을 러닝 이름으로: "인터벌 입문 3회차" */
export function sessionTitle(item: PlanItem, runs: readonly FinishedRun[]): string {
  return `${item.label} ${nextSession(item.label, runs)}회차`;
}

export function describeHome(input: HomeInput): HomeView {
  const { now, weeklyGoal, plan, runs } = input;
  const progress = weekProgress(runs, weeklyGoal, now);
  const plannedWeekdays = new Set(plan.map((item) => item.weekday));

  return {
    weekLabel: weekLabel(now),
    title: `이번 주 ${progress.count} / ${progress.goal}회${progress.met ? ' · 목표 달성' : ''}`,
    cells: weekCells(runs, plannedWeekdays, now),
    streakText: streakText(progress),
    today: todayCard(input),
  };
}

function todayCard({ now, plan, runs }: HomeInput): TodayCard {
  // 오늘 인정된 러닝이 있으면 완료. 10분을 못 채운 러닝만 있으면 아직 "오늘 뛸 것"을 보여 준다.
  const doneToday = latest(runs.filter((run) => run.counted && isSameDay(run.startedAt, now)));
  if (doneToday) return doneCard(doneToday, runs);

  if (plan.length === 0) {
    return {
      kind: 'noPlan',
      mode: 'free',
      title: '자유 20분',
      message: '오늘은 계획이 없어요. 가볍게 20분 뛰어 볼까요? 계획 탭에서 이번 주 계획을 세울 수도 있어요.',
      startLabel: '자유 20분 시작',
      config: NO_PLAN_CONFIG,
    };
  }

  const today = weekdayIndex(now);
  const item = plan.find((candidate) => candidate.weekday === today);
  if (item) return plannedCard(item, runs, now);

  return {
    kind: 'restDay',
    mode: 'free',
    title: '오늘은 쉬는 날이에요',
    message: `${nextPlannedText(plan, runs, today)} 몸이 가볍다면 10분만 뛰어도 1회로 인정돼요.`,
  };
}

function plannedCard(item: PlanItem, runs: readonly FinishedRun[], now: number): TodayCard {
  const title = sessionTitle(item, runs);
  const previous = previousComparable({ mode: item.mode, startedAt: now, avgPaceSecPerKm: null }, runs);
  return {
    kind: 'planned',
    mode: item.mode,
    title,
    description: describeConfig(item.config),
    estimate: describeEstimate(item.config),
    lastPaceText: previous ? `지난번 ${formatPace(previous.avgPaceSecPerKm)}/km` : null,
    reason: REASONS[item.mode],
    config: item.config,
    planLabel: title,
  };
}

function doneCard(run: FinishedRun, runs: readonly FinishedRun[]): TodayCard {
  const parts = [`${formatDistanceKm(run.distanceM)} km`, formatDuration(run.elapsedMs)];
  if (run.avgPaceSecPerKm != null) parts.push(`평균 ${formatPace(run.avgPaceSecPerKm)}/km`);
  return {
    kind: 'done',
    runId: run.id,
    mode: run.mode,
    title: run.planLabel ?? MODE_LABEL[run.mode],
    stats: parts.join(' · '),
    comparison: comparePace(run, previousComparable(run, runs)),
  };
}

/** "다음 러닝은 토요일 인터벌 입문 3회차예요." 오늘 이후 가장 가까운 계획 요일을 찾는다. */
function nextPlannedText(plan: readonly PlanItem[], runs: readonly FinishedRun[], today: number): string {
  for (let ahead = 1; ahead <= DAYS_PER_WEEK; ahead++) {
    const weekday = (today + ahead) % DAYS_PER_WEEK;
    const item = plan.find((candidate) => candidate.weekday === weekday);
    if (!item) continue;
    const nextWeek = today + ahead >= DAYS_PER_WEEK;
    const day = `${nextWeek ? '다음 주 ' : ''}${WEEKDAY_NAMES[weekday]}`;
    // 이름이 항상 "…회차"로 끝나므로 "예요"가 맞다
    return `다음 러닝은 ${day} ${sessionTitle(item, runs)}예요.`;
  }
  return '';
}

function latest(runs: readonly FinishedRun[]): FinishedRun | null {
  return runs.reduce<FinishedRun | null>((best, run) => (!best || run.startedAt > best.startedAt ? run : best), null);
}
