/**
 * 모드별 안내 판단. runEngine.tick이 매번 부른다.
 *
 * 규칙(pacerun-design.md 0-5 Flow B)
 * - 자유: 설정한 간격(km)마다 거리 · 평균 페이스
 * - 인터벌: 구간이 시작될 때, 끝나기 10초 전 예고
 * - 케이던스: 5분마다 시간 · 거리 (박자 소리는 services/metronome이 따로 낸다)
 * - 페이스메이커: 최근 20~30초 평균이 목표에서 ±10초를 벗어나면 알림(같은 안내는 최소 30초 간격), 안 벗어나면 1km마다만
 */
import { formatDuration, speakDistanceKm, speakDuration, speakPace } from './format';
import { INTERVAL_KIND_LABEL, intervalPositionAt, type IntervalConfig } from './interval';
import { averagePaceSecPerKm, recentPaceSecPerKm } from './pace';
// runEngine이 이 파일을 부르므로, 여기서는 runEngine의 타입만 가져온다(값을 가져오면 서로를 부르는 고리가 된다)
import type { Cue, RunSegment, RunState, StepOptions } from './runEngine';
import type { RunConfig } from './types';

export type ModeResult = {
  cues: Cue[];
  /** 모드가 기억해 둘 숫자(예: 마지막 페이스 안내 시각). 상태의 modeMemo에 합쳐진다. */
  memo?: Record<string, number>;
  /** 모드가 구간 기록을 직접 관리할 때(인터벌)만 돌려준다. */
  segments?: { segments: RunSegment[]; openSegment: RunState['openSegment'] };
};

/** 구간이 이보다 짧으면 "10초 전 예고"를 하지 않는다(시작 안내와 겹친다). */
export const INTERVAL_WARN_BEFORE_MS = 10_000;
const INTERVAL_WARN_MIN_STEP_MS = 20_000;

/** 케이던스 모드에서 시간 · 거리를 말하는 간격 */
export const CADENCE_REPORT_EVERY_MS = 5 * 60 * 1000;

/** 목표 페이스에서 이만큼(km당 초) 넘게 벗어나면 알린다 */
export const PACE_TOLERANCE_SEC = 10;
/** 페이스 안내끼리의 최소 간격 */
export const PACE_CUE_MIN_GAP_MS = 30_000;

export function modeCues(state: RunState, elapsed: number, options: StepOptions): ModeResult {
  const config = state.config;
  switch (config.mode) {
    case 'free':
      return freeCues(state, config, elapsed, options);
    case 'interval':
      return intervalCues(state, config, elapsed);
    case 'cadence':
      return cadenceCues(state, config, elapsed);
    case 'pacemaker':
      return pacemakerCues(state, config, elapsed);
  }
}

/** 지금까지 지난 km 지점 가운데 stepKm 배수인 것의 안내. 이미 내보낸 것은 엔진이 걸러 낸다. */
export function distanceCues(state: RunState, elapsed: number, stepKm: number): Cue[] {
  const step = Math.max(1, Math.round(stepKm));
  const passedKm = Math.floor(state.distanceM / 1000);
  const latest = passedKm - (passedKm % step);
  // 한 번에 여러 지점을 넘었어도(오랜만에 계산된 경우) 가장 최근 지점만 말한다
  return latest >= step ? [kmCue(latest, elapsed)] : [];
}

/** n km 지점 안내(자유 · 페이스메이커가 함께 쓴다). */
export function kmCue(km: number, elapsed: number): Cue {
  const meters = km * 1000;
  const pace = averagePaceSecPerKm(elapsed, meters);
  return {
    key: `km-${km}`,
    speech: pace ? `${speakDistanceKm(meters)}. 평균 페이스 ${speakPace(pace)}` : speakDistanceKm(meters),
    display: `${km}km를 지났어요`,
  };
}

type FreeConfig = Extract<RunConfig, { mode: 'free' }>;

function freeCues(state: RunState, config: FreeConfig, elapsed: number, options: StepOptions): ModeResult {
  const cues = distanceCues(state, elapsed, options.voiceIntervalKm);
  // 목표 시간을 채워도 자동으로 끝내지 않는다(직접 끝낼 때까지 기록). 채웠다는 것만 한 번 알린다.
  if (config.targetDurationSec != null && elapsed >= config.targetDurationSec * 1000) {
    cues.push({ key: 'free-target', speech: '목표 시간을 채웠어요', display: '목표 시간을 채웠어요' });
  }
  return { cues };
}

// ---------------------------------------------------------------- 인터벌

function intervalCues(state: RunState, config: IntervalConfig, elapsed: number): ModeResult {
  const position = intervalPositionAt(config, elapsed);
  const segments = intervalSegments(state, config, elapsed, position.step?.idx ?? position.total);
  const cues: Cue[] = [];

  if (!position.step) {
    cues.push({ key: 'interval-done', speech: '인터벌을 모두 마쳤어요. 수고했어요', display: '인터벌을 모두 마쳤어요' });
    return { cues, segments };
  }

  const { step, next } = position;
  const label = INTERVAL_KIND_LABEL[step.kind];
  cues.push({
    key: `interval-${step.idx}-start`,
    speech: `${label}. ${speakDuration(step.durationMs / 1000)}`,
    display: `${label} ${formatDuration(step.durationMs)}`,
  });

  // 끝나기 10초 전 예고. 타이머가 늦어 이미 지나갔으면(남은 시간이 0에 가까우면) 다음 구간 시작 안내가 대신한다.
  if (step.durationMs >= INTERVAL_WARN_MIN_STEP_MS && position.remainingMs <= INTERVAL_WARN_BEFORE_MS) {
    const upcoming = next ? INTERVAL_KIND_LABEL[next.kind] : '끝';
    cues.push({
      key: `interval-${step.idx}-warn`,
      speech: next ? `10초 뒤 ${upcoming}` : '10초 뒤 끝나요',
      display: next ? `10초 뒤 ${upcoming}` : '10초 뒤 끝나요',
    });
  }
  return { cues, segments };
}

/**
 * 인터벌의 구간 기록. 지금 구간(currentIdx)보다 앞선 열린 구간을 닫는다.
 * 일정을 모두 마친 뒤에는 km 구간으로 바꿔, 더 뛰는 동안은 엔진이 1km마다 구간을 닫게 한다.
 */
function intervalSegments(
  state: RunState,
  config: IntervalConfig,
  elapsed: number,
  currentIdx: number,
): ModeResult['segments'] {
  const open = state.openSegment;
  if (open.kind === 'km' || open.idx >= currentIdx) return undefined;

  const stepMs = { run: config.runSec * 1000, walk: config.walkSec * 1000 };
  const total = config.repeats * 2;
  const closed: RunSegment[] = [];
  let startedElapsedMs = open.startedElapsedMs;
  // 타이머가 늦어 여러 구간을 한꺼번에 넘었으면, 그동안 뛴 거리는 첫 구간에 넣는다(구간별로 나눌 근거가 없다)
  let distance = Math.max(0, state.distanceM - open.startDistanceM);
  for (let idx = open.idx; idx < currentIdx; idx++) {
    const kind = idx % 2 === 0 ? 'run' : 'walk';
    closed.push({ idx, kind, startedElapsedMs, durationMs: stepMs[kind], distanceM: distance });
    startedElapsedMs += stepMs[kind];
    distance = 0;
  }

  const finished = currentIdx >= total;
  return {
    segments: [...state.segments, ...closed],
    openSegment: {
      idx: currentIdx,
      kind: finished ? 'km' : currentIdx % 2 === 0 ? 'run' : 'walk',
      startedElapsedMs: finished ? startedElapsedMs : Math.min(startedElapsedMs, elapsed),
      startDistanceM: state.distanceM,
    },
  };
}

// ---------------------------------------------------------------- 케이던스

type CadenceConfig = Extract<RunConfig, { mode: 'cadence' }>;

function cadenceCues(state: RunState, config: CadenceConfig, elapsed: number): ModeResult {
  const cues: Cue[] = [];
  const reports = Math.floor(elapsed / CADENCE_REPORT_EVERY_MS);
  if (reports >= 1) {
    const minutes = (reports * CADENCE_REPORT_EVERY_MS) / 60_000;
    cues.push({
      key: `cadence-report-${reports}`,
      speech: `${minutes}분. ${speakDistanceKm(state.distanceM)}`,
      display: `${minutes}분 · ${speakDistanceKm(state.distanceM)}`,
    });
  }
  if (elapsed >= config.durationSec * 1000) {
    cues.push({ key: 'cadence-done', speech: '목표 시간을 채웠어요', display: '목표 시간을 채웠어요' });
  }
  return { cues };
}

// ---------------------------------------------------------------- 페이스메이커

type PacemakerConfig = Extract<RunConfig, { mode: 'pacemaker' }>;

/** 목표보다 얼마나 느린지(km당 초). 양수 = 느림, 음수 = 빠름. 최근 페이스를 알 수 없으면 null */
export function paceGapSec(state: RunState, config: PacemakerConfig): number | null {
  const current = recentPaceSecPerKm(state.paceSamples);
  return current == null ? null : current - config.targetPaceSecPerKm;
}

function pacemakerCues(state: RunState, config: PacemakerConfig, elapsed: number): ModeResult {
  if (state.distanceM >= config.distanceM) {
    return { cues: [{ key: 'pacemaker-done', speech: '목표 거리를 채웠어요', display: '목표 거리를 채웠어요' }] };
  }

  const gap = paceGapSec(state, config);
  const lastCueAt = state.modeMemo.paceCueAt;
  const quietEnough = lastCueAt == null || elapsed - lastCueAt >= PACE_CUE_MIN_GAP_MS;
  if (gap != null && Math.abs(gap) > PACE_TOLERANCE_SEC && quietEnough) {
    const seconds = Math.round(Math.abs(gap));
    const slow = gap > 0;
    return {
      cues: [
        {
          // 안내마다 이름이 달라야 30초 뒤에 다시 나갈 수 있다
          key: `pace-${Math.floor(elapsed / 1000)}`,
          speech: slow ? `조금 빠르게. 목표보다 ${seconds}초 느려요` : `조금 천천히. 목표보다 ${seconds}초 빨라요`,
          display: slow ? `목표보다 ${seconds}초 느려요` : `목표보다 ${seconds}초 빨라요`,
        },
      ],
      memo: { paceCueAt: elapsed },
    };
  }

  // 목표 범위 안이면 1km마다만 말한다
  return { cues: distanceCues(state, elapsed, 1) };
}
