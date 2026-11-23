/** 설정 화면(MY_01_001)에 그릴 값과, 고를 수 있는 값의 목록. 화면은 이 결과를 그리기만 한다. */
import { reminderChoiceOf, reminderSummaryText } from './reminderTime';
import { CONFIG_LIMITS, nearestCadence } from './runConfig';
import type { RunThemeSetting, Settings } from './types';

/** 자유 러닝에서 거리 · 페이스를 말해 주는 간격(km). 설정에서 고를 수 있는 값 — Q-004 */
export const VOICE_INTERVAL_OPTIONS: readonly number[] = [1, 2, 3, 5];

export function voiceIntervalText(km: number): string {
  return `${km}km마다`;
}

export function cadenceText(spm: number): string {
  return `분당 ${spm}걸음`;
}

/** 기본 발걸음 박자를 보여 줄 글자. 시작 전 설정이 쓰는 값(고를 수 있는 칸에 맞춘 값)과 같게 보여 준다. */
export function defaultCadenceText(spm: number): string {
  return cadenceText(nearestCadence(spm));
}

/** 기본 발걸음 박자를 한 칸 올리거나 내린다. 범위(시작 전 설정에서 고를 수 있는 범위와 같다) 끝에서는 그대로 둔다. */
export function stepDefaultCadence(spm: number, direction: 1 | -1): number {
  const { min, max, step } = CONFIG_LIMITS.cadenceSpm;
  return Math.min(max, Math.max(min, nearestCadence(spm) + direction * step));
}

export function canStepDefaultCadence(spm: number, direction: 1 | -1): boolean {
  return stepDefaultCadence(spm, direction) !== nearestCadence(spm);
}

export type RunThemeOption = { value: RunThemeSetting; label: string; description: string };

export const RUN_THEME_OPTIONS: readonly RunThemeOption[] = [
  { value: 'auto', label: '자동 (OS 설정 따름)', description: '폰이 다크 모드면 러닝 화면도 어둡게 보여요' },
  { value: 'light', label: '항상 밝게', description: '폰이 다크 모드여도 러닝 화면은 밝게 보여요' },
];

/** granted = 알림 권한 있음 / denied = 없음 / unknown = 아직 확인하지 못함 */
export type NotificationAccess = 'granted' | 'denied' | 'unknown';

/** 알림을 켜 두었는데 폰의 알림 권한이 꺼져 있을 때 알림 시간 줄 아래에 보여 주는 안내 */
export const REMINDER_BLOCKED_NOTICE = '알림 권한이 꺼져 있어 알림이 오지 않아요';

export type SettingsView = {
  /** "3회" */
  weeklyGoalText: string;
  /** "매일 오전 7:00" / "끔" */
  reminderText: string;
  /** 알림을 켜 두었는데 폰의 알림 권한이 꺼져 있을 때의 안내. 아니면 null */
  reminderNotice: string | null;
  voiceEnabled: boolean;
  /** "1km마다" */
  voiceIntervalText: string;
  /** "분당 170걸음" */
  cadenceText: string;
  /** "자동 (OS 설정 따름)" / "항상 밝게" */
  runThemeText: string;
};

export function describeSettings(settings: Settings, notifications: NotificationAccess): SettingsView {
  const reminder = reminderChoiceOf(settings.reminderTime);
  const theme = RUN_THEME_OPTIONS.find((option) => option.value === settings.runTheme) ?? RUN_THEME_OPTIONS[0];
  return {
    weeklyGoalText: `${settings.weeklyGoal}회`,
    reminderText: reminderSummaryText(reminder),
    // 확인하지 못한 동안(unknown)에는 안내를 띄우지 않는다 — 권한이 있는데 잠깐 경고가 보였다 사라지지 않게
    reminderNotice: reminder.enabled && notifications === 'denied' ? REMINDER_BLOCKED_NOTICE : null,
    voiceEnabled: settings.voiceEnabled,
    voiceIntervalText: voiceIntervalText(settings.voiceIntervalKm),
    cadenceText: defaultCadenceText(settings.defaultCadenceSpm),
    runThemeText: theme.label,
  };
}
