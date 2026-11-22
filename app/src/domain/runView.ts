/**
 * 러닝 중 화면에 보여 줄 글자와 숫자를 계산 상태에서 뽑아낸다.
 * 화면 컴포넌트는 여기서 받은 값을 그리기만 한다(모드마다 달라지는 판단을 화면에 두지 않는다).
 */
import { formatDistanceKm, formatDuration, formatKm, formatPace } from './format';
import {
  buildIntervalSteps,
  INTERVAL_KIND_LABEL,
  intervalPositionAt,
  type IntervalConfig,
  type IntervalKind,
  type IntervalPosition,
} from './interval';
import { PACE_TOLERANCE_SEC, paceGapSec } from './modeCues';
import { averagePaceSecPerKm } from './pace';
import { currentPaceSecPerKm, elapsedMs, msUntilCounted, type RunState } from './runEngine';
import type { RunConfig, RunMode } from './types';

export const MODE_LABEL: Record<RunMode, string> = {
  free: '자유 러닝',
  interval: '인터벌',
  cadence: '발걸음 박자',
  pacemaker: '페이스메이커',
};

/** 인터벌의 구간 띠(레인). 칸 너비는 구간 시간에 비례하게 그린다. */
export type LaneView = {
  steps: { kind: IntervalKind; durationMs: number }[];
  /** 지금 구간의 번호. 모두 마쳤으면 steps.length */
  currentIndex: number;
  /** 지금 구간이 얼마나 지났는지 0~1 */
  progress: number;
  /** "5 / 16 구간" — 색만으로 알리지 않기 위한 글자 */
  countText: string;
  /** "달리기 1:00 · 걷기 1:30 × 8" */
  caption: string;
};

/** 페이스메이커의 목표 띠 게이지. */
export type GaugeView = {
  /** 목표보다 얼마나 느린지(km당 초). 양수 = 느림. 아직 재는 중이면 null */
  gapSec: number | null;
  /** 이 범위(±초) 안이면 목표 띠 안이다 */
  toleranceSec: number;
  /** "+8초 느림" / "5초 빠름" / "목표 페이스" / "페이스를 재는 중" — 색만으로 알리지 않기 위한 글자 */
  text: string;
  /** 마커의 가로 위치 0(왼쪽 끝 = 느림) ~ 1(오른쪽 끝 = 빠름). 재는 중이면 null */
  markerRatio: number | null;
  /** 목표 띠의 너비(트랙 전체가 1) */
  bandRatio: number;
};

/** 게이지의 한쪽 끝은 목표에서 허용 범위의 이 배수만큼 벗어난 페이스다(±60초). 더 벗어나면 끝에 붙여 둔다. */
const GAUGE_RANGE_IN_TOLERANCES = 6;

export type RunView = {
  /** 맨 위 작은 제목(계획 이름 또는 모드 이름) */
  title: string;
  /** 맨 위 오른쪽 "경과 5:42" */
  elapsedText: string;
  /** 큰 숫자 위 라벨. 예: "달리기 · 남은 시간" */
  primaryLabel: string;
  /** 화면에서 가장 큰 숫자. 예: "0:18" */
  primaryValue: string;
  /** 큰 숫자 아래 한 줄. 예: "다음  걷기 1:30" */
  secondaryText: string;
  distanceText: string;
  /** 거리 숫자 아래 설명. GPS가 끊기면 "거리 · GPS 찾는 중" */
  distanceCaption: string;
  paceText: string;
  paceCaption: string;
  /** 가장 최근 음성 안내 문장. 아직 없으면 null */
  lastCue: string | null;
  gpsLost: boolean;
  paused: boolean;
  /** 일시정지 화면의 설명 줄. 인터벌이면 어떤 구간에서 멈췄는지도 알려 준다 */
  pausedText: string;
  /** 인터벌 모드에서만 있다 */
  lane: LaneView | null;
  /** 페이스메이커 모드에서만 있다 */
  gauge: GaugeView | null;
};

// GPS가 끊기면 두 지표의 설명 줄이 바뀐다(피그마 RUN_02_006)
const DISTANCE_CAPTION = '거리';
const DISTANCE_CAPTION_GPS_LOST = '거리 · GPS 찾는 중';
const PACE_CAPTION = '평균 페이스';
const PACE_CAPTION_GPS_LOST = '평균 페이스 · 잠시 멈춤';

export function describeRun(state: RunState, now: number): RunView {
  const elapsed = elapsedMs(state, now);
  const config = state.config;
  // 인터벌의 "지금 구간"은 한 번만 구해 큰 숫자 · 구간 띠 · 일시정지 문구가 함께 쓴다
  const position = config.mode === 'interval' ? intervalPositionAt(config, elapsed) : null;

  return {
    title: state.planLabel ?? MODE_LABEL[config.mode],
    elapsedText: `경과 ${formatDuration(elapsed)}`,
    ...primaryFor(state, now, elapsed, position),
    distanceText: `${formatDistanceKm(state.distanceM)} km`,
    distanceCaption: state.gpsLost ? DISTANCE_CAPTION_GPS_LOST : DISTANCE_CAPTION,
    paceText: `${formatPace(averagePaceSecPerKm(elapsed, state.distanceM))}/km`,
    paceCaption: state.gpsLost ? PACE_CAPTION_GPS_LOST : PACE_CAPTION,
    lastCue: state.lastCueDisplay,
    gpsLost: state.gpsLost,
    paused: state.status === 'paused',
    pausedText: pausedTextFor(position),
    lane: config.mode === 'interval' && position ? laneFor(config, position) : null,
    gauge: config.mode === 'pacemaker' ? gaugeFor(state, config) : null,
  };
}

type Primary = Pick<RunView, 'primaryLabel' | 'primaryValue' | 'secondaryText'>;

function primaryFor(state: RunState, now: number, elapsed: number, position: IntervalPosition | null): Primary {
  const config = state.config;
  switch (config.mode) {
    case 'free':
      return countdownPrimary('자유 러닝', config.targetDurationSec, state, now, elapsed, (target) => `목표 ${formatDuration(target * 1000)}`);
    case 'interval':
      return intervalPrimary(position ?? intervalPositionAt(config, elapsed), state, now, elapsed);
    case 'cadence':
      return countdownPrimary('발걸음 박자', config.durationSec, state, now, elapsed, () => `분당 ${config.spm}걸음`);
    case 'pacemaker':
      return pacemakerPrimary(config, state, now, elapsed);
  }
}

/** 경과 시간을 크게 보여 주고, 아래 줄에 1회 인정까지 남은 시간을 둔다. */
function elapsedPrimary(label: string, state: RunState, now: number, elapsed: number): Primary {
  return { primaryLabel: label, primaryValue: formatDuration(elapsed), secondaryText: countedText(state, now) };
}

/** 남은 시간을 올림해 보여 준다(1분짜리 구간이 "0:59"가 아니라 "1:00"에서 시작하게). */
function formatRemaining(ms: number): string {
  return formatDuration(Math.ceil(ms / 1000) * 1000);
}

/** 목표 시간이 있으면 남은 시간을 크게, 없거나 넘겼으면 경과 시간을 크게 보여 준다(자유 · 케이던스). */
function countdownPrimary(
  name: string,
  targetSec: number | null,
  state: RunState,
  now: number,
  elapsed: number,
  secondary: (targetSec: number) => string,
): Primary {
  if (targetSec == null) return elapsedPrimary('경과 시간', state, now, elapsed);
  const remainingMs = targetSec * 1000 - elapsed;
  if (remainingMs > 0) {
    return { primaryLabel: `${name} · 남은 시간`, primaryValue: formatRemaining(remainingMs), secondaryText: secondary(targetSec) };
  }
  // 목표 시간을 넘겨도 끝내지 않는다. 직접 끝낼 때까지 기록한다.
  return elapsedPrimary('목표를 채웠어요 · 경과 시간', state, now, elapsed);
}

function intervalPrimary(position: IntervalPosition, state: RunState, now: number, elapsed: number): Primary {
  if (!position.step) return elapsedPrimary('인터벌 완료 · 경과 시간', state, now, elapsed);
  const next = position.next;
  return {
    primaryLabel: `${INTERVAL_KIND_LABEL[position.step.kind]} · 남은 시간`,
    primaryValue: formatRemaining(position.remainingMs),
    secondaryText: next ? `다음  ${INTERVAL_KIND_LABEL[next.kind]} ${formatDuration(next.durationMs)}` : '다음  끝',
  };
}

/** 구간 목록은 목표값에만 달려 있다. 매초 새 배열을 만들지 않게 목표값마다 한 번만 만들어 둔다. */
const laneStepsCache = new WeakMap<IntervalConfig, LaneView['steps']>();

function laneSteps(config: IntervalConfig): LaneView['steps'] {
  let steps = laneStepsCache.get(config);
  if (!steps) {
    steps = buildIntervalSteps(config).map((step) => ({ kind: step.kind, durationMs: step.durationMs }));
    laneStepsCache.set(config, steps);
  }
  return steps;
}

function laneFor(config: IntervalConfig, position: IntervalPosition): LaneView {
  const current = position.step?.idx ?? position.total;
  return {
    steps: laneSteps(config),
    currentIndex: current,
    progress: position.progress,
    countText: `${Math.min(current + 1, position.total)} / ${position.total} 구간`,
    caption: `달리기 ${formatDuration(config.runSec * 1000)} · 걷기 ${formatDuration(config.walkSec * 1000)} × ${config.repeats}`,
  };
}

type PacemakerConfig = Extract<RunConfig, { mode: 'pacemaker' }>;

function pacemakerPrimary(config: PacemakerConfig, state: RunState, now: number, elapsed: number): Primary {
  const remainingM = config.distanceM - state.distanceM;
  if (remainingM <= 0) return elapsedPrimary('목표 거리를 채웠어요 · 경과 시간', state, now, elapsed);
  return {
    primaryLabel: '지금 페이스',
    primaryValue: formatPace(currentPaceSecPerKm(state)),
    secondaryText: `목표 ${formatPace(config.targetPaceSecPerKm)}/km · 남은 거리 ${formatKm(Math.ceil(remainingM / 100) * 100)}`,
  };
}

function gaugeFor(state: RunState, config: PacemakerConfig): GaugeView {
  const gap = paceGapSec(state, config);
  const range = PACE_TOLERANCE_SEC * GAUGE_RANGE_IN_TOLERANCES;
  return {
    gapSec: gap,
    toleranceSec: PACE_TOLERANCE_SEC,
    text: gaugeText(gap),
    // 느릴수록(gap이 클수록) 왼쪽
    markerRatio: gap == null ? null : 0.5 - Math.min(range, Math.max(-range, gap)) / range / 2,
    bandRatio: 1 / GAUGE_RANGE_IN_TOLERANCES,
  };
}

function gaugeText(gap: number | null): string {
  if (gap == null) return '페이스를 재는 중';
  // 음성 안내(modeCues)와 같은 기준으로 가른다: 허용 범위를 조금이라도 넘으면 벗어난 것
  if (Math.abs(gap) <= PACE_TOLERANCE_SEC) return '목표 페이스';
  const seconds = Math.round(Math.abs(gap));
  return gap > 0 ? `+${seconds}초 느림` : `${seconds}초 빠름`;
}

const SAVING_NOTE = '기록은 계속 저장되고 있어요.';

function pausedTextFor(position: IntervalPosition | null): string {
  const step = position?.step;
  return step ? `${INTERVAL_KIND_LABEL[step.kind]} 구간이 남았어요. ${SAVING_NOTE}` : SAVING_NOTE;
}

function countedText(state: RunState, now: number): string {
  const left = msUntilCounted(state, now);
  return left > 0 ? `1회 인정까지 ${formatDuration(left)}` : '오늘 1회 인정 완료';
}
