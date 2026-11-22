/** 러닝 목표값(RunConfig)의 기본값 · 범위 · 설명 문구. 시작 전 설정, 계획, 홈 카드가 함께 쓴다. */
import { formatPace, speakDuration } from './format';
import type { RunConfig, RunMode } from './types';

/** 목표값을 고를 때의 범위와 한 번에 바뀌는 크기 */
export const CONFIG_LIMITS = {
  freeDurationMin: { min: 10, max: 120, step: 5 },
  intervalRunSec: { min: 30, max: 600, step: 30 },
  intervalWalkSec: { min: 30, max: 600, step: 30 },
  intervalRepeats: { min: 1, max: 20, step: 1 },
  cadenceSpm: { min: 150, max: 190, step: 5 },
  cadenceDurationMin: { min: 10, max: 120, step: 5 },
  pacemakerPaceSec: { min: 240, max: 600, step: 10 },
  pacemakerDistanceKm: { min: 1, max: 21, step: 1 },
} as const;

/** [10분만 뛰기]로 시작하는 자유 10분 */
export const QUICK_RUN_CONFIG: RunConfig = { mode: 'free', targetDurationSec: 600 };
export const QUICK_RUN_LABEL = '10분만 뛰기';

/** 모드를 처음 골랐을 때 채워 둘 목표값(pacerun-design.md 0-4 템플릿 제안값) */
export function defaultConfigFor(mode: RunMode, defaultCadenceSpm: number): RunConfig {
  switch (mode) {
    case 'free':
      return { mode: 'free', targetDurationSec: 20 * 60 };
    case 'interval':
      return { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 };
    case 'cadence':
      return { mode: 'cadence', spm: nearestCadence(defaultCadenceSpm), durationSec: 20 * 60 };
    case 'pacemaker':
      return { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 };
  }
}

/** 메트로놈 소리 파일은 5 단위(150~190)로만 있다. 그 밖의 값은 가장 가까운 값으로 맞춘다. */
export function nearestCadence(spm: number): number {
  const { min, max, step } = CONFIG_LIMITS.cadenceSpm;
  const snapped = Math.round(spm / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** 목표값을 한 줄로 설명한다. 예: "1분 달리기 + 1분 30초 걷기 × 8" */
export function describeConfig(config: RunConfig): string {
  switch (config.mode) {
    case 'free':
      return config.targetDurationSec == null ? '시간 제한 없이' : `${speakDuration(config.targetDurationSec)} 동안`;
    case 'interval':
      return `${speakDuration(config.runSec)} 달리기 + ${speakDuration(config.walkSec)} 걷기 × ${config.repeats}`;
    case 'cadence':
      return `${speakDuration(config.durationSec)} · 분당 ${config.spm}걸음`;
    case 'pacemaker':
      return `${formatKm(config.distanceM)} · 목표 ${formatPace(config.targetPaceSecPerKm)}/km`;
  }
}

/** 예상 소요 시간(초). 시간 제한 없는 자유 러닝은 null */
export function estimatedDurationSec(config: RunConfig): number | null {
  switch (config.mode) {
    case 'free':
      return config.targetDurationSec;
    case 'interval':
      return (config.runSec + config.walkSec) * config.repeats;
    case 'cadence':
      return config.durationSec;
    case 'pacemaker':
      return Math.round((config.distanceM / 1000) * config.targetPaceSecPerKm);
  }
}

/** "약 20분" 같은 예상 시간 문구. 알 수 없으면 null */
export function describeEstimate(config: RunConfig): string | null {
  const sec = estimatedDurationSec(config);
  return sec == null ? null : `약 ${Math.max(1, Math.round(sec / 60))}분`;
}

function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`;
}
