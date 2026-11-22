/** 러닝 목표값(RunConfig)의 기본값 · 범위 · 설명 문구. 시작 전 설정, 계획, 홈 카드가 함께 쓴다. */
import { formatKm, formatPace, speakDuration } from './format';
import type { RunConfig, RunMode } from './types';

/**
 * 목표값을 고를 때의 범위와 한 번에 바뀌는 크기(화면에서 고를 수 있는 값).
 * settings.ts의 isRunConfig는 "저장돼 있던 값을 읽어도 되는지"만 보므로 이보다 범위가 넓다
 * (나중에 여기 범위를 바꿔도 예전에 저장한 값을 읽을 수 있게).
 */
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

/** 모드 카드의 순서(피그마 RUN_01_001). 시작 전 설정과 계획의 운동 추가 시트가 함께 쓴다. */
export const MODE_ORDER: readonly RunMode[] = ['interval', 'cadence', 'pacemaker', 'free'];

/** 모드 카드의 설명 문구 */
export function modeDescriptions(voiceIntervalKm: number): Record<RunMode, string> {
  return {
    interval: '달리기·걷기 구간을 음성으로 안내',
    cadence: '분당 걸음 수에 맞춰 박자 소리',
    pacemaker: '목표 페이스에서 벗어나면 알려 줌',
    free: `${voiceIntervalKm}km마다 거리·페이스만 안내`,
  };
}

/**
 * 시트에서 모드를 바꿨을 때 채울 목표값. 그 모드에서 쓰던 값을 되살린다:
 * 시트를 열 때 채워 둔 값 → 마지막으로 뛴 설정 → 그 모드의 기본값 순.
 */
export function configForMode(
  mode: RunMode,
  known: { opened: RunConfig; lastRunConfig: RunConfig | null; defaultCadenceSpm: number },
): RunConfig {
  if (known.opened.mode === mode) return known.opened;
  if (known.lastRunConfig?.mode === mode) return known.lastRunConfig;
  return defaultConfigFor(mode, known.defaultCadenceSpm);
}
