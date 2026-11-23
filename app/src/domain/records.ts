/**
 * 기록을 보여 주는 화면들에 그릴 값: 기록 탭(이번 주 막대 + 목록), 러닝 상세, 완료 요약.
 * 화면은 이 결과를 그리기만 한다.
 */
import { describeComparison, previousComparable, type ComparisonView } from './compare';
import { formatDateTime, formatDistanceKm, formatDuration, formatMonthDay, formatPace, formatTimeRange } from './format';
import type { FinishedRun } from './home';
import { INTERVAL_KIND_LABEL } from './interval';
import type { RunSegment } from './runEngine';
import { MODE_LABEL } from './runView';
import type { PlanItem, RunMode } from './types';
import { addDays, DAYS_PER_WEEK, startOfWeek, WEEKDAY_LABELS, WEEKDAY_NAMES, weekdayIndex, weekRangeText } from './week';
import { weekCells, weekProgress, type WeekCellView } from './weekProgress';

const KM = 1000;
/** 막대 차트 눈금의 바닥값. 이번 주 값이 모두 이보다 작아도(또는 0이어도) 이 거리를 막대 끝으로 본다 */
const MIN_CHART_SCALE_M = 100;

// ------------------------------------------------------------------ 기록 탭

export type ChartBarView = {
  /** "월" */
  label: string;
  isToday: boolean;
  /** 막대 위에 적는 값 "2.4". 그날 뛰지 않았으면 null(막대도 그리지 않는다) */
  valueText: string | null;
  /** 막대 높이: 차트에서 가장 큰 값(또는 목표선)을 1로 본 비율 0~1 */
  ratio: number;
};

export type RecordsChartView = {
  bars: ChartBarView[];
  /** 목표선. 그을 기준이 없으면 null */
  goal: { ratio: number; text: string } | null;
  /** 화면을 읽어 주는 기능용 한 줄 요약 */
  accessibilityLabel: string;
};

export type RunListItemView = {
  id: string;
  mode: RunMode;
  /** "인터벌 입문 3회차" */
  title: string;
  /** "11월 20일 (목) 오전 7:12" */
  dateText: string;
  /** "3.12 km" */
  distanceText: string;
  /** `6'02"/km`. 거리가 너무 짧아 알 수 없으면 null */
  paceText: string | null;
  accessibilityLabel: string;
};

export type RecordsView = {
  /** 끝난 러닝이 하나도 없음(빈 상태 화면) */
  isEmpty: boolean;
  /** "이번 주 · 11월 17일 – 23일" */
  rangeText: string;
  /** "7.1 km · 3회" */
  totalText: string;
  chart: RecordsChartView;
  /** 끝난 러닝 전체, 최신순 */
  items: RunListItemView[];
};

export type RecordsInput = { now: number; plan: readonly PlanItem[]; runs: readonly FinishedRun[] };

/** 소수 한 자리 km. 막대 값과 합계에 쓴다 */
function kmText(meters: number): string {
  return (meters / KM).toFixed(1);
}

export function runTitle(run: Pick<FinishedRun, 'planLabel' | 'mode'>): string {
  return run.planLabel ?? MODE_LABEL[run.mode];
}

export function describeRecords({ now, plan, runs }: RecordsInput): RecordsView {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK);
  const today = weekdayIndex(now);

  // 요일별 거리. 10분을 못 채운 러닝의 거리도 뛴 거리이므로 넣는다(횟수에는 넣지 않는다).
  const perDay = new Array<number>(DAYS_PER_WEEK).fill(0);
  let countedThisWeek = 0;
  for (const run of runs) {
    if (run.startedAt < weekStart || run.startedAt >= weekEnd) continue;
    perDay[weekdayIndex(run.startedAt)] += run.distanceM;
    if (run.counted) countedThisWeek += 1;
  }
  const totalM = perDay.reduce((sum, meters) => sum + meters, 0);

  const goalM = goalDistanceM(plan);
  // 막대와 목표선이 모두 들어가게 가장 큰 값에 맞춘다. 바닥값이 있어 한 주가 비어 있어도 0으로 나누지 않는다.
  const scaleM = Math.max(...perDay, goalM ?? 0, MIN_CHART_SCALE_M);

  const bars = WEEKDAY_LABELS.map((label, index): ChartBarView => {
    const meters = perDay[index];
    // 화면에 "0.0"으로 보일 만큼 짧으면 뛰지 않은 날처럼 비워 둔다
    const shown = Number(kmText(meters)) > 0;
    return { label, isToday: index === today, valueText: shown ? kmText(meters) : null, ratio: shown ? meters / scaleM : 0 };
  });

  const spoken = bars.map((bar, index) => (bar.valueText ? `${WEEKDAY_NAMES[index]} ${bar.valueText}킬로미터` : null));
  return {
    isEmpty: runs.length === 0,
    rangeText: `이번 주 · ${weekRangeText(now)}`,
    totalText: `${kmText(totalM)} km · ${countedThisWeek}회`,
    chart: {
      bars,
      goal: goalM == null ? null : { ratio: goalM / scaleM, text: `목표 ${Number(kmText(goalM))} km` },
      accessibilityLabel: ['이번 주 요일별 거리', ...spoken.filter(Boolean)].join(', '),
    },
    items: [...runs].sort((a, b) => b.startedAt - a.startedAt).map(listItem),
  };
}

/**
 * 막대 차트의 목표선: 계획에 거리 목표가 있는 운동(페이스메이커)이 있으면 그 거리(여럿이면 가장 긴 것).
 * 거리 목표가 없으면 선을 긋지 않는다 — 앱에 "하루 목표 거리" 설정이 없어 다른 값을 목표라고 부를 수 없다(Q-011).
 */
function goalDistanceM(plan: readonly PlanItem[]): number | null {
  let longest: number | null = null;
  for (const planned of plan) {
    if (planned.config.mode !== 'pacemaker') continue;
    longest = Math.max(longest ?? 0, planned.config.distanceM);
  }
  return longest;
}

function listItem(run: FinishedRun): RunListItemView {
  const title = runTitle(run);
  const dateText = formatDateTime(run.startedAt);
  const distanceText = `${formatDistanceKm(run.distanceM)} km`;
  return {
    id: run.id,
    mode: run.mode,
    title,
    dateText,
    distanceText,
    paceText: run.avgPaceSecPerKm == null ? null : `${formatPace(run.avgPaceSecPerKm)}/km`,
    accessibilityLabel: [title, dateText, distanceText].join(', '),
  };
}

// ------------------------------------------------------------------ 러닝 상세 · 완료 요약

export type StatView = { label: string; value: string };

export type SegmentRowView = {
  /** 1부터 센 구간 번호 */
  no: number;
  /** "달리기" / "걷기" / "1km" / "0.42km"(끝까지 못 채운 마지막 km 구간) */
  kindText: string;
  /** 쉬어 가는 구간(걷기). 화면이 달리기 구간보다 옅게 그린다 */
  resting: boolean;
  /** "1:30" */
  durationText: string;
  /** `5'38"`. 거리가 거의 없어 알 수 없으면 `-'--"` */
  paceText: string;
};

export type RunDetailView = {
  /** 상단 제목 "11월 20일 러닝" */
  headerTitle: string;
  comparison: ComparisonView | null;
  mode: RunMode;
  title: string;
  /** "11월 20일 (목) 오전 7:12 – 7:32" */
  timeText: string;
  stats: StatView[];
  /** 10분을 못 채운 기록이면 그 사실을 한 줄로. 아니면 null */
  note: string | null;
  segments: SegmentRowView[];
};

/** 이 거리 이상이면 km 구간을 "1km"로 적는다(GPS 오차로 999m에서 닫히는 경우를 받아 준다) */
const FULL_KM_MIN_M = 995;
/** 이 거리보다 짧은 구간은 페이스를 내지 않는다(값이 튄다) */
const SEGMENT_PACE_MIN_M = 10;
const NOT_COUNTED_NOTE = '10분을 채우지 못해 횟수에는 들어가지 않았어요';

type DetailRun = FinishedRun & { endedAt: number | null };

function comparisonFor(run: FinishedRun, runs: readonly FinishedRun[]): ComparisonView | null {
  return describeComparison(run, previousComparable(run, runs));
}

function statsFor(run: FinishedRun, paceSuffix: string): StatView[] {
  return [
    { label: '거리', value: `${formatDistanceKm(run.distanceM)} km` },
    { label: '시간', value: formatDuration(run.elapsedMs) },
    { label: '평균 페이스', value: run.avgPaceSecPerKm == null ? formatPace(null) : `${formatPace(run.avgPaceSecPerKm)}${paceSuffix}` },
  ];
}

export function describeRunDetail(input: {
  run: DetailRun;
  segments: readonly RunSegment[];
  runs: readonly FinishedRun[];
}): RunDetailView {
  const { run, segments, runs } = input;
  return {
    headerTitle: `${formatMonthDay(run.startedAt)} 러닝`,
    comparison: comparisonFor(run, runs),
    mode: run.mode,
    title: runTitle(run),
    timeText: run.endedAt == null ? formatDateTime(run.startedAt) : formatTimeRange(run.startedAt, run.endedAt),
    stats: statsFor(run, '/km'),
    note: run.counted ? null : NOT_COUNTED_NOTE,
    segments: segments.map(segmentRow),
  };
}

function segmentRow(segment: RunSegment, index: number): SegmentRowView {
  const kindText =
    segment.kind === 'km'
      ? segment.distanceM >= FULL_KM_MIN_M
        ? '1km'
        : `${(segment.distanceM / KM).toFixed(2)}km`
      : INTERVAL_KIND_LABEL[segment.kind];
  const pace =
    segment.distanceM >= SEGMENT_PACE_MIN_M ? segment.durationMs / 1000 / (segment.distanceM / KM) : null;
  return {
    no: index + 1,
    kindText,
    resting: segment.kind === 'walk',
    durationText: formatDuration(segment.durationMs),
    paceText: formatPace(pace),
  };
}

export type SummaryView = {
  comparison: ComparisonView | null;
  mode: RunMode;
  title: string;
  /** "11월 20일 (목) 오전 7:12" */
  dateText: string;
  stats: StatView[];
  /** 10분을 못 채운 기록이면 그 사실을 한 줄로. 인정된 러닝이면 null(아래 이번 주 칸이 알려 준다) */
  note: string | null;
  week: {
    /** "이번 주 3 / 3회" */
    title: string;
    /** "목표 달성 · 4주 연속". 아직 못 채웠으면 null */
    note: string | null;
    cells: WeekCellView[];
    /** 오늘 칸을 칠하게 만든 러닝(이 러닝이 인정됐을 때). 형광펜 칠하기를 한 번만 보여 주는 데 쓴다 */
    paintKey: string | null;
  };
};

export function describeSummary(input: {
  run: FinishedRun;
  runs: readonly FinishedRun[];
  plan: readonly PlanItem[];
  weeklyGoal: number;
  now: number;
}): SummaryView {
  const { run, runs, plan, weeklyGoal, now } = input;
  const progress = weekProgress(runs, weeklyGoal, now);
  const streakNote = progress.streak >= 2 ? `목표 달성 · ${progress.streak}주 연속` : '목표 달성';
  return {
    comparison: comparisonFor(run, runs),
    mode: run.mode,
    title: runTitle(run),
    dateText: formatDateTime(run.startedAt),
    stats: statsFor(run, ''),
    note: run.counted ? null : NOT_COUNTED_NOTE,
    week: {
      title: `이번 주 ${progress.count} / ${progress.goal}회`,
      note: progress.met ? streakNote : null,
      cells: weekCells(runs, new Set(plan.map((planned) => planned.weekday)), now),
      paintKey: run.counted ? run.id : null,
    },
  };
}
