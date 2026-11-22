import {
  DEFAULT_SETTINGS,
  RUN_MODES,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
  type RunConfig,
  type Settings,
} from './types';

const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// 저장돼 있던 값을 읽을 때 "말이 되는 값인가"만 보는 넓은 범위다(서버가 받는 범위와 같다).
// 화면에서 고를 수 있는 좁은 범위는 runConfig.ts의 CONFIG_LIMITS에 따로 있다 — 그 범위를 바꿔도 예전 값을 버리지 않으려는 것.
const CADENCE_SPM_MIN = 120;
const CADENCE_SPM_MAX = 220;
const VOICE_INTERVAL_KM_MIN = 1;
const VOICE_INTERVAL_KM_MAX = 10;
const INTERVAL_REPEATS_MIN = 1;
const INTERVAL_REPEATS_MAX = 99;

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** 저장돼 있던 러닝 설정이 지금 코드가 아는 모양인지 확인한다. */
export function isRunConfig(value: unknown): value is RunConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!RUN_MODES.includes(v.mode as RunConfig['mode'])) return false;
  switch (v.mode) {
    case 'free':
      return v.targetDurationSec === null || isPositive(v.targetDurationSec);
    case 'interval':
      return isPositive(v.runSec) && isPositive(v.walkSec) && isInt(v.repeats, INTERVAL_REPEATS_MIN, INTERVAL_REPEATS_MAX);
    case 'cadence':
      return isInt(v.spm, CADENCE_SPM_MIN, CADENCE_SPM_MAX) && isPositive(v.durationSec);
    case 'pacemaker':
      return isPositive(v.targetPaceSecPerKm) && isPositive(v.distanceM);
    default:
      return false;
  }
}

/** 설정 키마다 "이 값을 받아도 되는지" 확인하는 함수. 통과하지 못한 값은 기본값으로 둔다. */
const VALIDATORS: { [K in keyof Settings]: (value: unknown) => boolean } = {
  weeklyGoal: (v) => isInt(v, WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX),
  reminderTime: (v) => v === null || (typeof v === 'string' && REMINDER_TIME_PATTERN.test(v)),
  voiceEnabled: (v) => typeof v === 'boolean',
  voiceIntervalKm: (v) => isInt(v, VOICE_INTERVAL_KM_MIN, VOICE_INTERVAL_KM_MAX),
  defaultCadenceSpm: (v) => isInt(v, CADENCE_SPM_MIN, CADENCE_SPM_MAX),
  runTheme: (v) => v === 'auto' || v === 'light',
  onboardingDone: (v) => typeof v === 'boolean',
  lastRunConfig: (v) => v === null || isRunConfig(v),
  lastSyncAt: (v) => v === null || isPositive(v),
};

function isSettingsKey(key: string): key is keyof Settings {
  // `in`은 constructor 같은 객체 기본 이름도 통과시키므로 쓰지 않는다
  return Object.hasOwn(VALIDATORS, key);
}

/**
 * DB의 (key, value) 줄들을 설정 객체로 합친다.
 * 저장된 적 없는 키, 모르는 키, JSON이 깨진 값, 타입이나 범위가 틀린 값은 기본값으로 둔다.
 */
export function mergeSettings(rows: readonly { key: string; value: string }[]): Settings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!isSettingsKey(row.key)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      continue;
    }
    if (VALIDATORS[row.key](parsed)) merged[row.key] = parsed;
  }
  return merged as Settings;
}
