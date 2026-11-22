/**
 * 러닝 한 번의 상태를 "지금 시각"으로 계산하는 순수 함수 모음(D-005).
 *
 * - 시간을 세지 않는다. 시작 시각과 지금 시각의 차이에서 일시정지 시간을 빼 경과 시간을 구한다.
 *   그래서 화면이 꺼져 타이머가 늦게 불려도 값이 틀리지 않는다.
 * - 상태를 고치지 않고 새 상태를 돌려준다. 기기 없이 테스트할 수 있다.
 * - 이미 내보낸 안내는 키를 상태에 적어 두어 두 번 내보내지 않는다.
 */
import { distanceM, type LatLng } from './geo';
import { modeCues } from './modeCues';
import { averagePaceSecPerKm, recentPaceSecPerKm, type PaceSample } from './pace';
import { COUNTED_MIN_ELAPSED_MS, type RunConfig } from './types';

/** 이보다 부정확한(오차 반경이 큰) 위치는 버린다. */
export const MAX_ACCURACY_M = 30;
/** 이보다 적게 움직인 위치는 거리로 더하지 않는다(제자리 GPS 흔들림). */
export const MIN_MOVE_M = 2;
/** 이보다 빠르면 GPS가 튄 것으로 보고 버린다(초속 9m ≈ 1km에 1분 51초). */
export const MAX_SPEED_MPS = 9;
/** 이 시간 동안 쓸 만한 위치가 없으면 'GPS 끊김'으로 본다. */
export const GPS_LOST_AFTER_MS = 10_000;
/** 시작 직후에는 위치 서비스가 켜지고 첫 위치가 오기까지 더 걸린다. 첫 위치는 이만큼 기다려 준다. */
export const GPS_FIRST_FIX_GRACE_MS = 20_000;
/** 끊겼던 신호가 돌아왔을 때 화면의 '최근 안내' 줄에 보여 줄 문구(음성으로는 말하지 않는다) */
export const GPS_BACK_DISPLAY = 'GPS 신호를 다시 잡았어요';
/** 현재 페이스는 최근 이 시간의 평균으로 구한다. */
export const PACE_WINDOW_MS = 30_000;

const KM = 1000;

export type LocationFix = LatLng & {
  /** 위치를 잰 시각(epoch 밀리초) */
  t: number;
  /** 오차 반경(미터). 모르면 null */
  accuracy: number | null;
};

/** 거리로 인정한 위치 점. DB의 run_points 한 줄과 같다. */
export type RunPoint = LocationFix & { elapsedMs: number };

export type SegmentKind = 'run' | 'walk' | 'km';

/** 구간 기록. DB의 run_segments 한 줄과 같다. */
export type RunSegment = {
  idx: number;
  kind: SegmentKind;
  startedElapsedMs: number;
  durationMs: number;
  distanceM: number;
};

/** 음성으로 말하고 화면 '최근 안내' 줄에 보여 줄 안내 하나 */
export type Cue = {
  /** 같은 안내를 두 번 내보내지 않기 위한 이름 */
  key: string;
  /** 음성으로 읽을 문장 */
  speech: string;
  /** 화면에 보여 줄 짧은 문장 */
  display: string;
  /** 토스트로도 띄울지(10분 인정) */
  toast?: boolean;
};


export type RunState = {
  runId: string;
  config: RunConfig;
  planLabel: string | null;
  startedAt: number;
  status: 'active' | 'paused';
  /** 지금 일시정지가 시작된 시각. 달리는 중이면 null */
  pausedAt: number | null;
  /** 끝난 일시정지들의 합 */
  pausedTotalMs: number;
  distanceM: number;
  /** 마지막으로 거리 계산의 기준이 된 위치. 일시정지 · GPS 끊김 뒤에는 null로 돌려 다시 잡는다. */
  anchor: LocationFix | null;
  /** 마지막으로 쓸 만한 위치를 받은 시각 */
  lastFixAt: number | null;
  gpsLost: boolean;
  /** 현재 페이스 계산용 최근 표본 */
  paceSamples: PaceSample[];
  segments: RunSegment[];
  /** 아직 끝나지 않은 구간의 시작점 */
  openSegment: { idx: number; kind: SegmentKind; startedElapsedMs: number; startDistanceM: number };
  /** 이미 내보낸 안내의 키 */
  emitted: string[];
  /** 모드별 안내가 쓰는 메모(예: 마지막 페이스 안내 시각) */
  modeMemo: Record<string, number>;
  /** 10분을 채워 주간 횟수 1회로 인정됐는지 */
  counted: boolean;
  /** 가장 최근에 내보낸 안내의 화면 문장 */
  lastCueDisplay: string | null;
};

export type StepOptions = {
  /** 자유 모드에서 몇 km마다 거리 · 페이스를 말할지 */
  voiceIntervalKm: number;
};

export type StepResult = { state: RunState; cues: Cue[] };

export function startRun(args: {
  runId: string;
  config: RunConfig;
  planLabel: string | null;
  now: number;
}): StepResult {
  const state: RunState = {
    runId: args.runId,
    config: args.config,
    planLabel: args.planLabel,
    startedAt: args.now,
    status: 'active',
    pausedAt: null,
    pausedTotalMs: 0,
    distanceM: 0,
    anchor: null,
    lastFixAt: null,
    gpsLost: false,
    paceSamples: [],
    segments: [],
    openSegment: { idx: 0, kind: firstSegmentKind(args.config), startedElapsedMs: 0, startDistanceM: 0 },
    emitted: [],
    modeMemo: {},
    counted: false,
    lastCueDisplay: null,
  };
  return emit(state, [{ key: 'start', speech: '시작합니다', display: '시작합니다' }]);
}

function firstSegmentKind(config: RunConfig): SegmentKind {
  return config.mode === 'interval' ? 'run' : 'km';
}

/** 일시정지를 뺀 경과 시간 */
export function elapsedMs(state: RunState, now: number): number {
  const until = state.status === 'paused' && state.pausedAt != null ? state.pausedAt : now;
  return Math.max(0, until - state.startedAt - state.pausedTotalMs);
}

export function pause(state: RunState, now: number): StepResult {
  if (state.status === 'paused') return { state, cues: [] };
  const paused: RunState = { ...state, status: 'paused', pausedAt: now };
  return emit(paused, [{ key: `pause-${now}`, speech: '일시정지', display: '일시정지' }]);
}

export function resume(state: RunState, now: number): StepResult {
  if (state.status !== 'paused' || state.pausedAt == null) return { state, cues: [] };
  const resumed: RunState = {
    ...state,
    status: 'active',
    pausedAt: null,
    pausedTotalMs: state.pausedTotalMs + (now - state.pausedAt),
    // 멈춰 있는 동안 움직인 거리는 세지 않도록 기준 위치를 다시 잡는다
    anchor: null,
    lastFixAt: now,
    gpsLost: false,
    paceSamples: [],
  };
  return emit(resumed, [{ key: `resume-${now}`, speech: '다시 시작합니다', display: '다시 시작합니다' }]);
}

/**
 * 강제 종료 복구용: 마지막으로 저장된 시각(savedAt)에 멈춘 것으로 바꾼다.
 * 앱이 꺼져 있던 시간을 일시정지로 쳐서, 이어서 뛰어도 경과 시간에 들어가지 않게 한다. 안내는 내지 않는다.
 */
export function suspendAt(state: RunState, savedAt: number): RunState {
  if (state.status === 'paused') return state;
  return { ...state, status: 'paused', pausedAt: Math.max(savedAt, state.startedAt) };
}

/**
 * 새 위치 하나를 반영한다. 거리로 인정했으면 point에 저장할 점을 돌려준다.
 * 일시정지 중이거나 부정확한 위치는 무시한다.
 */
export function applyLocation(state: RunState, fix: LocationFix): { state: RunState; point: RunPoint | null } {
  if (state.status !== 'active') return { state, point: null };
  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M) return { state, point: null };
  if (state.anchor && fix.t <= state.anchor.t) return { state, point: null };
  // 재개하기 전(멈춰 있던 동안)에 잰 위치가 늦게 도착한 경우. 기준점으로 쓰면 멈춰 있던 동안의 이동이 섞인다.
  if (!state.anchor && state.lastFixAt != null && fix.t < state.lastFixAt) return { state, point: null };

  const elapsed = elapsedMs(state, fix.t);
  const fresh: RunState = {
    ...state,
    lastFixAt: fix.t,
    gpsLost: false,
    // 끊겼다 돌아왔으면 화면에 남아 있는 "찾는 중" 문구를 바꿔 준다
    lastCueDisplay: state.gpsLost ? GPS_BACK_DISPLAY : state.lastCueDisplay,
  };

  // 기준 위치가 없거나(시작 · 재개 직후) 신호가 한동안 끊겼다 돌아왔으면, 그 사이 거리는 더하지 않고 기준만 다시 잡는다
  const gapMs = state.anchor ? fix.t - state.anchor.t : 0;
  if (!state.anchor || gapMs > GPS_LOST_AFTER_MS) {
    return { state: { ...fresh, anchor: fix }, point: { ...fix, elapsedMs: elapsed } };
  }

  const moved = distanceM(state.anchor, fix);
  if (moved < MIN_MOVE_M) return { state: fresh, point: null };
  if (moved / (gapMs / 1000) > MAX_SPEED_MPS) return { state: fresh, point: null };

  const distance = state.distanceM + moved;
  const samples = [...state.paceSamples, { elapsedMs: elapsed, distanceM: distance }].filter(
    (s) => elapsed - s.elapsedMs <= PACE_WINDOW_MS,
  );
  return {
    state: { ...fresh, anchor: fix, distanceM: distance, paceSamples: samples },
    point: { ...fix, elapsedMs: elapsed },
  };
}

/**
 * 지금 시각 기준으로 상태를 갱신하고 내보낼 안내를 고른다.
 * 위치가 올 때와 1초 타이머가 울릴 때 둘 다 이 함수를 부른다. 몇 번을 불러도 결과가 같다.
 */
export function tick(state: RunState, now: number, options: StepOptions): StepResult {
  if (state.status !== 'active') return { state, cues: [] };

  const elapsed = elapsedMs(state, now);
  let next = state;
  const cues: Cue[] = [];

  // GPS 끊김: 처음 위치를 받기 전에는 시작 시각부터 재고, 조금 더 기다려 준다
  const lastSeen = state.lastFixAt ?? state.startedAt;
  const lostAfter = state.lastFixAt == null ? GPS_FIRST_FIX_GRACE_MS : GPS_LOST_AFTER_MS;
  if (!state.gpsLost && now - lastSeen > lostAfter) {
    next = { ...next, gpsLost: true, anchor: null, paceSamples: [] };
    cues.push({
      key: `gps-lost-${lastSeen}`,
      speech: 'GPS 신호가 약해요. 거리는 잠시 멈출게요',
      display: 'GPS 신호를 찾는 중이에요',
    });
  }

  next = closeKmSegments(next, elapsed);

  if (!next.counted && elapsed >= COUNTED_MIN_ELAPSED_MS) {
    next = { ...next, counted: true };
    cues.push({ key: 'counted', speech: '오늘 1회 인정!', display: '오늘 1회 인정!', toast: true });
  }

  const mode = modeCues(next, elapsed, options);
  if (mode.memo) next = { ...next, modeMemo: { ...next.modeMemo, ...mode.memo } };
  if (mode.segments) next = { ...next, segments: mode.segments.segments, openSegment: mode.segments.openSegment };
  cues.push(...mode.cues);

  return emit(next, cues);
}

/** 1km를 넘을 때마다 km 구간을 닫는다(인터벌은 달리기 · 걷기 구간을 쓰므로 제외). */
function closeKmSegments(state: RunState, elapsed: number): RunState {
  if (state.openSegment.kind !== 'km') return state;
  let { segments, openSegment } = state;
  while (state.distanceM - openSegment.startDistanceM >= KM) {
    segments = [
      ...segments,
      {
        idx: openSegment.idx,
        kind: 'km',
        startedElapsedMs: openSegment.startedElapsedMs,
        durationMs: elapsed - openSegment.startedElapsedMs,
        distanceM: KM,
      },
    ];
    openSegment = {
      idx: openSegment.idx + 1,
      kind: 'km',
      startedElapsedMs: elapsed,
      startDistanceM: openSegment.startDistanceM + KM,
    };
  }
  return segments === state.segments ? state : { ...state, segments, openSegment };
}

/** 최근 20~30초의 평균 페이스(km당 초). 표본이 모자라면 null */
export function currentPaceSecPerKm(state: RunState): number | null {
  return recentPaceSecPerKm(state.paceSamples);
}

export type RunSummary = {
  runId: string;
  endedAt: number;
  elapsedMs: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
  counted: boolean;
  segments: RunSegment[];
};

/** 러닝을 끝낸다. 열려 있던 마지막 구간을 닫아 요약을 만든다. */
export function finish(state: RunState, now: number): RunSummary {
  const elapsed = elapsedMs(state, now);
  const open = state.openSegment;
  const lastDuration = elapsed - open.startedElapsedMs;
  const segments =
    lastDuration > 0
      ? [
          ...state.segments,
          {
            idx: open.idx,
            kind: open.kind,
            startedElapsedMs: open.startedElapsedMs,
            durationMs: lastDuration,
            distanceM: Math.max(0, state.distanceM - open.startDistanceM),
          },
        ]
      : state.segments;

  return {
    runId: state.runId,
    endedAt: state.status === 'paused' && state.pausedAt != null ? state.pausedAt : now,
    elapsedMs: elapsed,
    distanceM: state.distanceM,
    avgPaceSecPerKm: averagePaceSecPerKm(elapsed, state.distanceM),
    counted: elapsed >= COUNTED_MIN_ELAPSED_MS,
    segments,
  };
}

/** 10분 인정까지 남은 시간(밀리초). 이미 채웠으면 0 */
export function msUntilCounted(state: RunState, now: number): number {
  return Math.max(0, COUNTED_MIN_ELAPSED_MS - elapsedMs(state, now));
}

/** 이미 내보낸 안내를 걸러 내고, 내보낸 키와 최근 안내 문장을 상태에 적는다. */
function emit(state: RunState, cues: Cue[]): StepResult {
  const fresh = cues.filter((cue) => !state.emitted.includes(cue.key));
  if (fresh.length === 0) return { state, cues: [] };
  return {
    state: {
      ...state,
      emitted: [...state.emitted, ...fresh.map((cue) => cue.key)],
      lastCueDisplay: fresh[fresh.length - 1].display,
    },
    cues: fresh,
  };
}
