import { describe, expect, it } from 'vitest';

import { CONFIG_LIMITS } from './runConfig';
import {
  canStepDefaultCadence,
  defaultCadenceText,
  describeSettings,
  REMINDER_BLOCKED_NOTICE,
  reminderChoiceOf,
  reminderSummaryText,
  reminderTimeOf,
  RUN_THEME_OPTIONS,
  stepDefaultCadence,
  VOICE_INTERVAL_OPTIONS,
} from './settingsView';
import { DEFAULT_SETTINGS, type Settings } from './types';

function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('설정 화면에 그릴 값', () => {
  it('기본값을 글자로 보여 준다', () => {
    expect(describeSettings(settings(), 'granted')).toEqual({
      weeklyGoalText: '3회',
      reminderText: '끔',
      reminderNotice: null,
      voiceEnabled: true,
      voiceIntervalText: '1km마다',
      cadenceText: '분당 170걸음',
      runThemeText: '자동 (OS 설정 따름)',
    });
  });

  it('바꾼 값을 글자로 보여 준다', () => {
    const view = describeSettings(
      settings({ weeklyGoal: 5, reminderTime: '19:30', voiceEnabled: false, voiceIntervalKm: 2, defaultCadenceSpm: 180, runTheme: 'light' }),
      'granted',
    );
    expect(view).toMatchObject({
      weeklyGoalText: '5회',
      reminderText: '매일 오후 7:30',
      voiceEnabled: false,
      voiceIntervalText: '2km마다',
      cadenceText: '분당 180걸음',
      runThemeText: '항상 밝게',
    });
  });

  it('고를 수 있는 칸에 없는 발걸음 값은 가장 가까운 칸으로 보여 준다(시작 전 설정과 같게)', () => {
    expect(describeSettings(settings({ defaultCadenceSpm: 172 }), 'granted').cadenceText).toBe('분당 170걸음');
    expect(describeSettings(settings({ defaultCadenceSpm: 210 }), 'granted').cadenceText).toBe('분당 190걸음');
  });

  it('알림 시간 줄의 글자는 온보딩과 같은 함수로 만든다', () => {
    expect(reminderSummaryText({ enabled: true, clock: { hour: 0, minute: 5 } })).toBe('매일 오전 12:05');
    expect(reminderSummaryText({ enabled: false, clock: { hour: 7, minute: 0 } })).toBe('끔');
    expect(defaultCadenceText(172)).toBe('분당 170걸음');
  });

  it('모양이 틀린 알림 시간은 끈 것으로 보여 준다', () => {
    expect(describeSettings(settings({ reminderTime: '25:99' }), 'granted').reminderText).toBe('끔');
  });
});

describe('알림 권한 안내', () => {
  it('알림을 켜 두었는데 권한이 없으면 안내한다', () => {
    expect(describeSettings(settings({ reminderTime: '07:00' }), 'denied').reminderNotice).toBe(REMINDER_BLOCKED_NOTICE);
  });

  it('알림을 꺼 두었으면 권한이 없어도 안내하지 않는다', () => {
    expect(describeSettings(settings({ reminderTime: null }), 'denied').reminderNotice).toBeNull();
  });

  it('권한을 아직 확인하지 못했으면 안내하지 않는다', () => {
    expect(describeSettings(settings({ reminderTime: '07:00' }), 'unknown').reminderNotice).toBeNull();
  });
});

describe('알림 시간 고르기', () => {
  it('저장된 시각을 고르는 칸의 값으로 바꾸고 되돌린다', () => {
    const choice = reminderChoiceOf('06:40');
    expect(choice).toEqual({ enabled: true, clock: { hour: 6, minute: 40 } });
    expect(reminderTimeOf(choice)).toBe('06:40');
  });

  it('꺼져 있으면 기본 시각(오전 7시)을 채워 두고, 저장할 값은 null이다', () => {
    const choice = reminderChoiceOf(null);
    expect(choice).toEqual({ enabled: false, clock: { hour: 7, minute: 0 } });
    expect(reminderTimeOf(choice)).toBeNull();
    expect(reminderTimeOf({ ...choice, enabled: true })).toBe('07:00');
  });
});

describe('기본 발걸음 박자 고르기', () => {
  const { min, max, step } = CONFIG_LIMITS.cadenceSpm;

  it('한 칸씩 오르내린다', () => {
    expect(stepDefaultCadence(170, 1)).toBe(170 + step);
    expect(stepDefaultCadence(170, -1)).toBe(170 - step);
  });

  it('범위 끝에서는 더 가지 않는다', () => {
    expect(stepDefaultCadence(max, 1)).toBe(max);
    expect(stepDefaultCadence(min, -1)).toBe(min);
    expect(canStepDefaultCadence(max, 1)).toBe(false);
    expect(canStepDefaultCadence(max, -1)).toBe(true);
    expect(canStepDefaultCadence(min, -1)).toBe(false);
  });

  it('칸에 없는 값에서 시작해도 칸 위의 값으로 간다', () => {
    expect(stepDefaultCadence(172, 1)).toBe(175);
    expect(stepDefaultCadence(210, -1)).toBe(max - step);
  });
});

describe('고를 수 있는 값의 목록', () => {
  it('안내 간격은 저장할 수 있는 범위(1~10km의 정수) 안에 있고 기본값을 포함한다', () => {
    expect(VOICE_INTERVAL_OPTIONS).toContain(DEFAULT_SETTINGS.voiceIntervalKm);
    for (const km of VOICE_INTERVAL_OPTIONS) {
      expect(Number.isInteger(km)).toBe(true);
      expect(km).toBeGreaterThanOrEqual(1);
      expect(km).toBeLessThanOrEqual(10);
    }
  });

  it('러닝 화면 테마는 자동과 항상 밝게 둘이다', () => {
    expect(RUN_THEME_OPTIONS.map((option) => option.value)).toEqual(['auto', 'light']);
  });
});
