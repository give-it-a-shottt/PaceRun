/** 대시보드(WEB_01_002)에 그릴 값: 기간 제목 · 막대 차트 · 합계 · 평균 페이스. 화면은 이 결과를 그리기만 한다. */
import { formatGapSeconds, formatHoursMinutes, formatKmOneDecimal, formatPace } from './format';
import type { Stats, StatsPeriod } from './types';

export type Metric = 'distance' | 'count' | 'time';

export const METRIC_LABELS: Record<Metric, string> = { distance: '거리', count: '횟수', time: '시간' };
export const PERIOD_LABELS: Record<StatsPeriod, string> = { month: '월', year: '년' };

const METRIC_UNITS: Record<Metric, string> = { distance: 'km', count: '회', time: '분' };
/** 평균 페이스는 이 거리 이상 뛴 기간에만 낸다(너무 짧으면 값이 튄다) */
const PACE_MIN_DISTANCE_M = 100;
/** 월 차트의 가로 눈금: 1일과 5의 배수 날짜만 적는다(31개를 다 적으면 겹친다) */
const DAY_LABEL_STEP = 5;

// ------------------------------------------------------------------ 기간

/** "YYYY-MM-DD" (그 사람이 있는 곳의 날짜) */
export function toDateText(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateText(text: string): { year: number; month: number; day: number } {
  const [year, month, day] = text.split('-').map(Number);
  return { year, month, day };
}

/** 기준 날짜를 한 기간 앞(−1) · 뒤(+1)로 옮긴다. 결과는 그 기간의 첫날이다. */
export function shiftAnchor(period: StatsPeriod, anchor: string, direction: 1 | -1): string {
  const { year, month } = parseDateText(anchor);
  // Date가 달 · 해 넘김을 알아서 처리한다(13월 → 다음 해 1월)
  const moved = period === 'month' ? new Date(year, month - 1 + direction, 1) : new Date(year + direction, 0, 1);
  return toDateText(moved);
}

/** 기준 날짜가 든 기간이 오늘이 든 기간인가(다음 기간으로 넘기는 버튼을 막는 데 쓴다) */
export function isCurrentPeriod(period: StatsPeriod, anchor: string, today: string): boolean {
  const a = parseDateText(anchor);
  const t = parseDateText(today);
  return a.year === t.year && (period === 'year' || a.month === t.month);
}

// ------------------------------------------------------------------ 그릴 값

export type ChartBar = {
  /** 가로 눈금 글자. 적지 않는 칸은 null */
  axisLabel: string | null;
  /** 도움말 · 읽어 주기용 이름: "11월 20일", "3월" */
  name: string;
  value: number;
  /** 막대 위에 적는 값. 0이면 null(막대도 없다) */
  valueText: string | null;
};

export type StatItem = { label: string; value: string };

export type DashboardView = {
  /** 제목 윗줄 "2026년"(년 단위면 빈 글자) */
  eyebrow: string;
  /** "11월 기록" / "2026년 기록" */
  title: string;
  /** "일별 거리 (km)" */
  chartTitle: string;
  bars: ChartBar[];
  /** 차트를 글로 읽어 주는 한 줄: "일별 거리 (km), 11월 2일 3, 11월 20일 3.1" (값이 있는 칸만) */
  chartSummary: string;
  /** 기록이 하나도 없는 기간 */
  isEmpty: boolean;
  /** "이번 달" / "10월 합계" / "올해" / "2025년 합계" */
  totalsTitle: string;
  totals: StatItem[];
  /** `5'58"/km`. 낼 수 없으면 `-'--"/km` */
  paceText: string;
  /** "지난달보다 7초 빨라졌어요". 비교할 수 없으면 까닭을 적는다 */
  paceNote: string;
  /** 빨라졌으면 'faster', 느려졌으면 'slower', 같거나 비교할 수 없으면 null(아이콘을 고르는 데 쓴다) */
  paceTrend: 'faster' | 'slower' | null;
  /** "이 기간 4주 가운데 3주 달성" */
  goalWeeksText: string;
};

function metricValue(metric: Metric, bucket: { distance_m: number; count: number; elapsed_s: number }): number {
  if (metric === 'distance') return bucket.distance_m / 1000;
  if (metric === 'count') return bucket.count;
  return bucket.elapsed_s / 60;
}

function metricText(metric: Metric, value: number): string | null {
  // 거리는 소수 한 자리, 횟수 · 분은 정수. "0"으로 보일 값은 적지 않는다.
  const text = metric === 'distance' ? String(Number(value.toFixed(1))) : String(Math.round(value));
  return Number(text) > 0 ? text : null;
}

function averagePace(totals: { distance_m: number; elapsed_s: number }): number | null {
  if (totals.distance_m < PACE_MIN_DISTANCE_M) return null;
  return totals.elapsed_s / (totals.distance_m / 1000);
}

function paceComparison(
  period: StatsPeriod,
  current: number | null,
  previous: number | null,
): Pick<DashboardView, 'paceNote' | 'paceTrend'> {
  const before = period === 'month' ? '지난달' : '지난해';
  if (current == null) return { paceNote: '이 기간에는 기록이 없어요', paceTrend: null };
  if (previous == null) return { paceNote: `${before} 기록이 없어 비교하지 않았어요`, paceTrend: null };
  // 페이스는 km당 초라서 값이 작을수록 빠르다
  const faster = Math.round(previous - current);
  if (faster > 0) return { paceNote: `${before}보다 ${formatGapSeconds(faster)} 빨라졌어요`, paceTrend: 'faster' };
  if (faster < 0) return { paceNote: `${before}보다 ${formatGapSeconds(-faster)} 느려졌어요`, paceTrend: 'slower' };
  return { paceNote: `${before}과 같은 페이스예요`, paceTrend: null };
}

export type DashboardInput = {
  stats: Stats;
  /** 바로 앞 기간의 통계(페이스 비교용). 아직 받지 못했으면 null */
  previous: Stats | null;
  metric: Metric;
  /** 오늘 "YYYY-MM-DD" */
  today: string;
};

export function describeDashboard({ stats, previous, metric, today }: DashboardInput): DashboardView {
  const { year, month } = parseDateText(stats.start);
  const isMonth = stats.period === 'month';
  const current = isCurrentPeriod(stats.period, stats.start, today);

  const bars = stats.buckets.map((bucket, index): ChartBar => {
    const value = metricValue(metric, bucket);
    const day = index + 1;
    return {
      axisLabel: isMonth ? (day === 1 || day % DAY_LABEL_STEP === 0 ? bucket.label : null) : bucket.label,
      name: isMonth ? `${month}월 ${bucket.label}일` : bucket.label,
      value,
      valueText: metricText(metric, value),
    };
  });

  const pace = averagePace(stats.totals);
  const chartTitle = `${isMonth ? '일별' : '월별'} ${METRIC_LABELS[metric]} (${METRIC_UNITS[metric]})`;
  return {
    eyebrow: isMonth ? `${year}년` : '',
    title: isMonth ? `${month}월 기록` : `${year}년 기록`,
    chartTitle,
    bars,
    chartSummary: [chartTitle, ...bars.filter((bar) => bar.valueText != null).map((bar) => `${bar.name} ${bar.valueText}`)].join(', '),
    isEmpty: stats.totals.distance_m === 0 && stats.totals.count === 0 && stats.totals.elapsed_s === 0,
    totalsTitle: isMonth ? (current ? '이번 달' : `${month}월 합계`) : current ? '올해' : `${year}년 합계`,
    totals: [
      { label: '거리', value: `${formatKmOneDecimal(stats.totals.distance_m)} km` },
      { label: '횟수', value: `${stats.totals.count}회` },
      { label: '시간', value: formatHoursMinutes(stats.totals.elapsed_s) },
    ],
    paceText: `${formatPace(pace)}/km`,
    // 앞 기간을 아직 받지 못했으면 비교 문구를 비워 둔다("기록이 없어"라고 잘못 말하지 않게)
    ...(previous || pace == null
      ? paceComparison(stats.period, pace, previous ? averagePace(previous.totals) : null)
      : { paceNote: '', paceTrend: null }),
    goalWeeksText: `이 기간 ${stats.goal_weeks.total}주 가운데 ${stats.goal_weeks.achieved}주 달성`,
  };
}
