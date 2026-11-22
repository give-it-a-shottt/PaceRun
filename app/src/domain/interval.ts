/** 인터벌(달리기 · 걷기 반복)의 구간 일정. 경과 시간만 넣으면 지금 몇 번째 구간인지 알 수 있다. */
import type { RunConfig } from './types';

export type IntervalConfig = Extract<RunConfig, { mode: 'interval' }>;
export type IntervalKind = 'run' | 'walk';

export type IntervalStep = {
  /** 0부터 센 구간 번호. 짝수는 달리기, 홀수는 걷기 */
  idx: number;
  kind: IntervalKind;
  startMs: number;
  durationMs: number;
};

/** "1분 달리기 + 1분 30초 걷기 × 8"이면 구간 16개(달리기 8 + 걷기 8)를 순서대로 만든다. */
export function buildIntervalSteps(config: IntervalConfig): IntervalStep[] {
  const steps: IntervalStep[] = [];
  let startMs = 0;
  for (let round = 0; round < config.repeats; round++) {
    for (const kind of ['run', 'walk'] as const) {
      const durationMs = (kind === 'run' ? config.runSec : config.walkSec) * 1000;
      steps.push({ idx: steps.length, kind, startMs, durationMs });
      startMs += durationMs;
    }
  }
  return steps;
}

export function intervalTotalMs(config: IntervalConfig): number {
  return (config.runSec + config.walkSec) * config.repeats * 1000;
}

export type IntervalPosition = {
  /** 지금 구간. 일정을 모두 마쳤으면 null */
  step: IntervalStep | null;
  /** 다음 구간. 마지막 구간이거나 이미 마쳤으면 null */
  next: IntervalStep | null;
  /** 지금 구간에서 남은 시간 */
  remainingMs: number;
  /** 지금 구간이 얼마나 지났는지 0~1 */
  progress: number;
  /** 전체 구간 수 */
  total: number;
};

/** 경과 시간으로 지금 구간을 찾는다. 타이머가 늦게 불려 구간을 건너뛰었어도 답은 같다. */
export function intervalPositionAt(config: IntervalConfig, elapsedMs: number): IntervalPosition {
  const stepMs = { run: config.runSec * 1000, walk: config.walkSec * 1000 };
  const roundMs = stepMs.run + stepMs.walk;
  const total = config.repeats * 2;
  if (elapsedMs >= roundMs * config.repeats) {
    return { step: null, next: null, remainingMs: 0, progress: 1, total };
  }

  const round = Math.floor(elapsedMs / roundMs);
  const inRound = elapsedMs - round * roundMs;
  const kind: IntervalKind = inRound < stepMs.run ? 'run' : 'walk';
  const idx = round * 2 + (kind === 'run' ? 0 : 1);
  const startMs = round * roundMs + (kind === 'run' ? 0 : stepMs.run);
  const durationMs = stepMs[kind];
  const passed = elapsedMs - startMs;

  const nextKind: IntervalKind = kind === 'run' ? 'walk' : 'run';
  const next =
    idx + 1 < total ? { idx: idx + 1, kind: nextKind, startMs: startMs + durationMs, durationMs: stepMs[nextKind] } : null;

  return {
    step: { idx, kind, startMs, durationMs },
    next,
    remainingMs: durationMs - passed,
    progress: passed / durationMs,
    total,
  };
}

export const INTERVAL_KIND_LABEL: Record<IntervalKind, string> = { run: '달리기', walk: '걷기' };
