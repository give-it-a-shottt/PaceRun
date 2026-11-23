/**
 * 폰의 러닝 ↔ 서버 API의 러닝을 서로 바꾼다(overview/data-model.md "폰 ↔ 서버 이름 대응").
 * 올릴 때는 서버가 받는 범위에 맞추고(Q-006), 내려받은 값은 모양을 확인한 뒤에만 쓴다.
 */
import type { RunPoint, RunSegment, SegmentKind } from './runEngine';
import { isRunConfig } from './settings';
import { COUNTED_MIN_ELAPSED_MS, RUN_MODES, type RunConfig, type RunMode } from './types';

// 서버가 받는 상한(server/app/schemas/run.py와 같아야 한다)
export const SERVER_LIMITS = {
  elapsedS: 24 * 60 * 60,
  distanceM: 300_000,
  routePoints: 20_000,
  segments: 1_000,
  planLabel: 50,
  paceSecPerKm: 24 * 60 * 60,
  intervalStepS: 60 * 60,
  intervalRepeats: 99,
  cadenceSpm: { min: 120, max: 220 },
} as const;

/** 폰에 저장된 러닝 한 건에서 올리는 데 필요한 칸 */
export type SyncableRun = {
  mode: RunMode;
  config: RunConfig;
  planLabel: string | null;
  startedAt: number;
  endedAt: number | null;
  elapsedMs: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
};

export type ServerSegment = {
  idx: number;
  kind: SegmentKind;
  started_elapsed_s: number;
  duration_s: number;
  distance_m: number;
};

/** [위도, 경도, 경과 초] */
export type ServerRoutePoint = [number, number, number];

/** PUT /runs/{id}의 본문(RunIn) */
export type RunUpload = {
  mode: RunMode;
  config: Record<string, number | null>;
  plan_label: string | null;
  started_at: string;
  ended_at: string;
  elapsed_s: number;
  distance_m: number;
  avg_pace_s_per_km: number | null;
  segments: ServerSegment[];
  route: ServerRoutePoint[];
};

/** 올릴 수 없는 까닭. too-long = 24시간을 넘김 / too-far = 300km를 넘김 / unfinished = 끝난 시각이 없음 */
export type UnsendableReason = 'too-long' | 'too-far' | 'unfinished';

export type UploadDecision = { kind: 'upload'; body: RunUpload } | { kind: 'skip'; reason: UnsendableReason };

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** 폰의 목표값(camelCase, mode 포함) → 서버의 config(snake_case, mode 없음). 실수는 정수로, 범위 밖은 범위 안으로 맞춘다. */
export function configToServer(config: RunConfig): Record<string, number | null> {
  switch (config.mode) {
    case 'free':
      return {
        target_duration_sec:
          config.targetDurationSec == null ? null : clampInt(config.targetDurationSec, 1, SERVER_LIMITS.elapsedS),
      };
    case 'interval':
      return {
        run_sec: clampInt(config.runSec, 1, SERVER_LIMITS.intervalStepS),
        walk_sec: clampInt(config.walkSec, 1, SERVER_LIMITS.intervalStepS),
        repeats: clampInt(config.repeats, 1, SERVER_LIMITS.intervalRepeats),
      };
    case 'cadence':
      return {
        spm: clampInt(config.spm, SERVER_LIMITS.cadenceSpm.min, SERVER_LIMITS.cadenceSpm.max),
        duration_sec: clampInt(config.durationSec, 1, SERVER_LIMITS.elapsedS),
      };
    case 'pacemaker':
      return {
        target_pace_s_per_km: clampInt(config.targetPaceSecPerKm, 1, SERVER_LIMITS.paceSecPerKm),
        distance_m: clampInt(config.distanceM, 1, SERVER_LIMITS.distanceM),
      };
  }
}

/** 점을 고르게 솎는다. 처음과 끝 점은 반드시 남긴다. */
function thin<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const step = (items.length - 1) / (max - 1);
  const kept: T[] = [];
  for (let index = 0; index < max; index++) kept.push(items[Math.round(index * step)]);
  return kept;
}

/**
 * 끝난 러닝 한 건을 서버에 올릴 모양으로 바꾼다.
 * 서버 상한을 넘어 올릴 수 없는 기록(24시간 · 300km 초과)은 올리지 않고 까닭을 돌려준다 — 그대로 보내면 영영 422다.
 */
export function toRunUpload(
  run: SyncableRun,
  segments: readonly RunSegment[],
  points: readonly Pick<RunPoint, 'lat' | 'lng' | 'elapsedMs'>[],
): UploadDecision {
  if (run.endedAt == null) return { kind: 'skip', reason: 'unfinished' };
  // 내림: 반올림하면 599.5초가 600초가 되어 폰과 서버의 10분 인정이 어긋난다
  const elapsedS = Math.floor(run.elapsedMs / 1000);
  if (elapsedS > SERVER_LIMITS.elapsedS) return { kind: 'skip', reason: 'too-long' };
  if (run.distanceM > SERVER_LIMITS.distanceM) return { kind: 'skip', reason: 'too-far' };

  const pace = run.avgPaceSecPerKm;
  return {
    kind: 'upload',
    body: {
      mode: run.mode,
      config: configToServer(run.config),
      plan_label: run.planLabel == null ? null : run.planLabel.replaceAll('\u0000', '').slice(0, SERVER_LIMITS.planLabel),
      started_at: new Date(run.startedAt).toISOString(),
      // 시계가 뒤로 맞춰져 끝 시각이 시작보다 빠르게 적힌 기록도 서버가 받게 한다
      ended_at: new Date(Math.max(run.endedAt, run.startedAt)).toISOString(),
      elapsed_s: elapsedS,
      distance_m: Math.max(0, run.distanceM),
      avg_pace_s_per_km: pace != null && pace > 0 && pace <= SERVER_LIMITS.paceSecPerKm ? pace : null,
      segments: segments.slice(0, SERVER_LIMITS.segments).map((segment, index) => ({
        idx: index,
        kind: segment.kind,
        started_elapsed_s: clampInt(segment.startedElapsedMs / 1000, 0, SERVER_LIMITS.elapsedS),
        duration_s: clampInt(segment.durationMs / 1000, 0, SERVER_LIMITS.elapsedS),
        distance_m: Math.min(SERVER_LIMITS.distanceM, Math.max(0, segment.distanceM)),
      })),
      route: thin(points, SERVER_LIMITS.routePoints).map((point) => [
        point.lat,
        point.lng,
        Math.min(SERVER_LIMITS.elapsedS, Math.max(0, point.elapsedMs / 1000)),
      ]),
    },
  };
}

// ------------------------------------------------------------------ 내려받기

/** 서버에서 내려받은 러닝 한 건을 폰에 넣을 모양으로 바꾼 것 */
export type DownloadedRun = {
  id: string;
  mode: RunMode;
  config: RunConfig;
  planLabel: string | null;
  startedAt: number;
  endedAt: number;
  elapsedMs: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
  counted: boolean;
  segments: RunSegment[];
  points: RunPoint[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 서버의 config(snake_case) → 폰의 목표값. 모르는 모양이면 null */
export function configFromServer(mode: RunMode, config: unknown): RunConfig | null {
  if (!isObject(config)) return null;
  let candidate: unknown;
  switch (mode) {
    case 'free':
      candidate = { mode, targetDurationSec: config.target_duration_sec ?? null };
      break;
    case 'interval':
      candidate = { mode, runSec: config.run_sec, walkSec: config.walk_sec, repeats: config.repeats };
      break;
    case 'cadence':
      candidate = { mode, spm: config.spm, durationSec: config.duration_sec };
      break;
    case 'pacemaker':
      candidate = { mode, targetPaceSecPerKm: config.target_pace_s_per_km, distanceM: config.distance_m };
      break;
  }
  return isRunConfig(candidate) ? candidate : null;
}

const SEGMENT_KINDS: readonly SegmentKind[] = ['run', 'walk', 'km'];

function segmentFromServer(value: unknown): RunSegment | null {
  if (!isObject(value)) return null;
  const { idx, kind, started_elapsed_s: startedS, duration_s: durationS, distance_m: distanceM } = value;
  if (!isFiniteNumber(idx) || !SEGMENT_KINDS.includes(kind as SegmentKind)) return null;
  if (!isFiniteNumber(startedS) || !isFiniteNumber(durationS) || !isFiniteNumber(distanceM)) return null;
  return {
    idx,
    kind: kind as SegmentKind,
    startedElapsedMs: startedS * 1000,
    durationMs: durationS * 1000,
    distanceM,
  };
}

/**
 * GET /runs/{id}의 응답(RunDetail)을 폰에 넣을 모양으로 바꾼다.
 * 모양이 틀리면 null(그 기록은 건너뛴다 — 틀린 값을 폰 DB에 넣지 않는다).
 */
export function fromServerRun(value: unknown): DownloadedRun | null {
  if (!isObject(value)) return null;
  const { id, mode, plan_label: planLabel, elapsed_s: elapsedS, distance_m: distanceM, avg_pace_s_per_km: pace } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!RUN_MODES.includes(mode as RunMode)) return null;
  const config = configFromServer(mode as RunMode, value.config);
  if (!config) return null;
  if (planLabel != null && typeof planLabel !== 'string') return null;

  const startedAt = typeof value.started_at === 'string' ? Date.parse(value.started_at) : NaN;
  const endedAt = typeof value.ended_at === 'string' ? Date.parse(value.ended_at) : NaN;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return null;
  if (!isFiniteNumber(elapsedS) || elapsedS < 0 || !isFiniteNumber(distanceM) || distanceM < 0) return null;
  if (pace != null && !(isFiniteNumber(pace) && pace > 0)) return null;

  if (!Array.isArray(value.segments) || !Array.isArray(value.route)) return null;
  const segments: RunSegment[] = [];
  for (const item of value.segments) {
    const segment = segmentFromServer(item);
    if (!segment) return null;
    segments.push(segment);
  }
  const points: RunPoint[] = [];
  for (const item of value.route) {
    if (!Array.isArray(item) || item.length < 3 || !item.slice(0, 3).every(isFiniteNumber)) return null;
    const [lat, lng, pointElapsedS] = item as number[];
    points.push({
      lat,
      lng,
      // 서버에는 점마다의 시각이 없다. 일시정지가 없었다고 보고 시작 시각 + 경과 시간으로 채운다(화면은 이 값을 쓰지 않는다).
      t: startedAt + Math.round(pointElapsedS * 1000),
      accuracy: null,
      elapsedMs: Math.round(pointElapsedS * 1000),
    });
  }

  const elapsedMs = elapsedS * 1000;
  return {
    id,
    mode: mode as RunMode,
    config,
    planLabel: planLabel ?? null,
    startedAt,
    endedAt,
    elapsedMs,
    distanceM,
    avgPaceSecPerKm: pace ?? null,
    // 서버가 정한 값을 믿되, 없으면 같은 기준(10분)으로 정한다
    counted: typeof value.counted === 'boolean' ? value.counted : elapsedMs >= COUNTED_MIN_ELAPSED_MS,
    segments,
    points,
  };
}
