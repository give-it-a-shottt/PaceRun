/** 러닝 목록의 한 줄과 러닝 상세(WEB_01_003)에 그릴 값. 화면은 이 결과를 그리기만 한다. */
import {
  formatDateTimeRange,
  formatDistanceKm,
  formatDuration,
  formatSecondsText,
  formatKm,
  formatListDateTime,
  formatMonthDay,
  formatPace,
} from './format';
import type { RunDetail, RunMode, RunSegment, RunSummary } from './types';

export const MODE_LABELS: Record<RunMode, string> = {
  free: '자유',
  interval: '인터벌',
  cadence: '발걸음 박자',
  pacemaker: '페이스메이커',
};

/** 계획 없이 뛴 러닝의 제목과 비교 문장에 쓰는 모드 이름 */
const MODE_NOUNS: Record<RunMode, string> = {
  free: '자유 러닝',
  interval: '인터벌',
  cadence: '발걸음 박자',
  pacemaker: '페이스메이커',
};

const SEGMENT_KIND_LABELS = { run: '달리기', walk: '걷기' } as const;
/** 이 거리 이상이면 km 구간을 "1km"로 적는다(GPS 오차로 999m에서 닫히는 경우를 받아 준다) */
const FULL_KM_MIN_M = 995;
/** 이 거리보다 짧은 구간은 페이스를 내지 않는다(값이 튄다) */
const SEGMENT_PACE_MIN_M = 10;
const NO_VALUE = '–';

export function runTitle(run: Pick<RunSummary, 'plan_label' | 'mode'>): string {
  return run.plan_label ?? MODE_NOUNS[run.mode];
}

// ------------------------------------------------------------------ 목록

export type RunRowView = {
  id: string;
  /** "11월 20일 (목) 07:12" */
  dateText: string;
  mode: RunMode;
  modeLabel: string;
  title: string;
  /** "3.12 km" */
  distanceText: string;
  /** "20:14" */
  durationText: string;
  /** `6'02"` */
  paceText: string;
};

export function describeRunRow(run: RunSummary): RunRowView {
  return {
    id: run.id,
    dateText: formatListDateTime(run.started_at),
    mode: run.mode,
    modeLabel: MODE_LABELS[run.mode],
    title: runTitle(run),
    distanceText: `${formatDistanceKm(run.distance_m)} km`,
    durationText: formatDuration(run.elapsed_s),
    paceText: formatPace(run.avg_pace_s_per_km),
  };
}

// ------------------------------------------------------------------ 상세

export type SegmentRowView = {
  no: number;
  /** "달리기" / "걷기" / "1km" / "0.42km" */
  kindText: string;
  /** 쉬어 가는 구간(걷기). 화면이 옅게 그린다 */
  resting: boolean;
  durationText: string;
  paceText: string;
};

export type ComparisonView = {
  /** "지난번보다 페이스가 8초 빨라졌어요" / "첫 인터벌 기록이에요" */
  text: string;
  /** `같은 인터벌 기준 · 6'10" → 6'02"`. 비교할 지난 기록이 없으면 null */
  detail: string | null;
};

export type RunDetailView = {
  /** 길잡이 줄의 마지막 칸 "11월 20일 러닝" */
  breadcrumb: string;
  mode: RunMode;
  modeLabel: string;
  title: string;
  /** "2026년 11월 20일 (목) 오전 7:12 – 7:32" */
  timeText: string;
  /** 이번 페이스를 알 수 없거나 지난 기록을 아직 찾는 중이면 null(상자를 그리지 않는다) */
  comparison: ComparisonView | null;
  /** 모드별 목표 한 줄 "목표 · 1분 달리기 + 1분 30초 걷기 × 8"(길어서 지표 칸이 아니라 제목 아래 한 줄로 보여 준다) */
  goalText: string;
  /** 거리 · 시간 · 평균 페이스 */
  stats: { label: string; value: string }[];
  /** 10분을 못 채운 기록이면 그 사실을 한 줄로 */
  note: string | null;
  segments: SegmentRowView[];
  /** 지도에 그릴 경로 [위도, 경도]. 점이 2개 미만이면 빈 배열(지도 대신 안내를 보여 준다) */
  path: [number, number][];
};

/** 모드별 목표를 한 줄로: "1분 달리기 + 1분 30초 걷기 × 8". 모르는 모양이면 "–" */
export function describeGoal(run: Pick<RunSummary, 'mode' | 'config'>): string {
  const num = (key: string): number | null => {
    const value = run.config[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  switch (run.mode) {
    case 'free': {
      const target = num('target_duration_sec');
      return target == null ? '제한 없음' : formatSecondsText(target);
    }
    case 'interval': {
      const [runSec, walkSec, repeats] = [num('run_sec'), num('walk_sec'), num('repeats')];
      if (runSec == null || walkSec == null || repeats == null) return NO_VALUE;
      return `${formatSecondsText(runSec)} 달리기 + ${formatSecondsText(walkSec)} 걷기 × ${repeats}`;
    }
    case 'cadence': {
      const [spm, duration] = [num('spm'), num('duration_sec')];
      if (spm == null || duration == null) return NO_VALUE;
      return `분당 ${spm}걸음 · ${formatSecondsText(duration)}`;
    }
    case 'pacemaker': {
      const [pace, distance] = [num('target_pace_s_per_km'), num('distance_m')];
      if (pace == null || distance == null) return NO_VALUE;
      return `${formatKm(distance)} · ${formatPace(pace)}/km`;
    }
    default:
      return NO_VALUE;
  }
}

function segmentKindText(segment: RunSegment): string {
  if (segment.kind !== 'km') return SEGMENT_KIND_LABELS[segment.kind];
  if (segment.distance_m >= FULL_KM_MIN_M) return '1km';
  return `${(segment.distance_m / 1000).toFixed(2)}km`;
}

function segmentRow(segment: RunSegment, index: number): SegmentRowView {
  const pace = segment.distance_m >= SEGMENT_PACE_MIN_M ? segment.duration_s / (segment.distance_m / 1000) : null;
  return {
    no: index + 1,
    kindText: segmentKindText(segment),
    resting: segment.kind === 'walk',
    durationText: formatDuration(segment.duration_s),
    paceText: formatPace(pace),
  };
}

/**
 * 같은 모드의 바로 앞 기록: 이 러닝보다 먼저 시작했고, 10분 이상 뛰었고(인정), 평균 페이스가 있는 것 가운데 가장 최근.
 * (앱과 같은 규칙 — Q-012 임시 처리)
 */
export function previousComparable(run: RunSummary, others: readonly RunSummary[]): RunSummary | null {
  const startedAt = Date.parse(run.started_at);
  let found: RunSummary | null = null;
  for (const other of others) {
    if (other.id === run.id || other.mode !== run.mode || !other.counted || other.avg_pace_s_per_km == null) continue;
    const otherStartedAt = Date.parse(other.started_at);
    if (!(otherStartedAt < startedAt)) continue;
    if (!found || otherStartedAt > Date.parse(found.started_at)) found = other;
  }
  return found;
}

export function describeComparison(run: RunSummary, previous: RunSummary | null): ComparisonView | null {
  if (!previous || previous.avg_pace_s_per_km == null) {
    return { text: `첫 ${MODE_NOUNS[run.mode]} 기록이에요`, detail: null };
  }
  if (run.avg_pace_s_per_km == null) return null;
  // 페이스는 km당 초라서 값이 작을수록 빠르다
  const faster = Math.round(previous.avg_pace_s_per_km - run.avg_pace_s_per_km);
  let text = '지난번과 같은 페이스로 뛰었어요';
  if (faster > 0) text = `지난번보다 페이스가 ${formatSecondsText(faster)} 빨라졌어요`;
  if (faster < 0) text = `지난번보다 ${formatSecondsText(-faster)} 천천히 뛰었어요`;
  return {
    text,
    detail: `같은 ${MODE_NOUNS[run.mode]} 기준 · ${formatPace(previous.avg_pace_s_per_km)} → ${formatPace(run.avg_pace_s_per_km)}`,
  };
}

/** previous: 같은 모드의 바로 앞 기록(없으면 null). 아직 찾는 중이면 'loading'(비교 상자를 그리지 않는다). */
export function describeRunDetail(run: RunDetail, previous: RunSummary | null | 'loading'): RunDetailView {
  return {
    breadcrumb: `${formatMonthDay(run.started_at)} 러닝`,
    mode: run.mode,
    modeLabel: MODE_LABELS[run.mode],
    title: runTitle(run),
    timeText: formatDateTimeRange(run.started_at, run.ended_at),
    comparison: previous === 'loading' ? null : describeComparison(run, previous),
    goalText: `목표 · ${describeGoal(run)}`,
    stats: [
      { label: '거리', value: `${formatDistanceKm(run.distance_m)} km` },
      { label: '시간', value: formatDuration(run.elapsed_s) },
      { label: '평균 페이스', value: `${formatPace(run.avg_pace_s_per_km)}/km` },
    ],
    note: run.counted ? null : '10분을 채우지 못해 횟수에는 들어가지 않았어요',
    segments: run.segments.map(segmentRow),
    path: run.route.length >= 2 ? run.route.map(([lat, lng]): [number, number] => [lat, lng]) : [],
  };
}
