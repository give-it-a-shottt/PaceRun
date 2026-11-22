/** 러닝 모드 4개. 서버 · 웹과 같은 문자열을 쓴다(overview/api-list.md). */
export type RunMode = 'free' | 'interval' | 'cadence' | 'pacemaker';

export const RUN_MODES: readonly RunMode[] = ['free', 'interval', 'cadence', 'pacemaker'];

/** 모드별 목표값. `runs.config_json`과 `plan_items.config_json`에 그대로 저장한다. */
export type RunConfig =
  | { mode: 'free'; targetDurationSec: number | null }
  | { mode: 'interval'; runSec: number; walkSec: number; repeats: number }
  | { mode: 'cadence'; spm: number; durationSec: number }
  | { mode: 'pacemaker'; targetPaceSecPerKm: number; distanceM: number };

export type RunStatus = 'active' | 'paused' | 'finished';

export type SyncState = 'local' | 'synced';

/** 러닝 화면 테마 설정: 자동(OS 설정 따름) / 항상 밝게 */
export type RunThemeSetting = 'auto' | 'light';

export type Settings = {
  /** 주 목표 횟수 2~5 */
  weeklyGoal: number;
  /** 알림 시간 "HH:mm". 끄면 null */
  reminderTime: string | null;
  voiceEnabled: boolean;
  /** 자유 모드에서 몇 km마다 거리 · 페이스를 말할지 */
  voiceIntervalKm: number;
  /** 케이던스 모드의 기본 분당 걸음 수 */
  defaultCadenceSpm: number;
  runTheme: RunThemeSetting;
  onboardingDone: boolean;
  /** 시작 전 설정 시트가 기억하는 마지막 설정 */
  lastRunConfig: RunConfig | null;
  /** 마지막으로 서버와 맞춘 시각(epoch 밀리초) */
  lastSyncAt: number | null;
};

export const DEFAULT_SETTINGS: Settings = {
  weeklyGoal: 3,
  reminderTime: null,
  voiceEnabled: true,
  voiceIntervalKm: 1,
  defaultCadenceSpm: 170,
  runTheme: 'auto',
  onboardingDone: false,
  lastRunConfig: null,
  lastSyncAt: null,
};

export const WEEKLY_GOAL_MIN = 2;
export const WEEKLY_GOAL_MAX = 5;

/** 이 시간 이상 뛰어야 주간 횟수 1회로 인정한다(10분). */
export const COUNTED_MIN_ELAPSED_MS = 10 * 60 * 1000;
