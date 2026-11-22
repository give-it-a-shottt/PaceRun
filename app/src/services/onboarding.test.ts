import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveSetting } from '@/db/settingsRepo';
import { DEFAULT_SETTINGS } from '@/domain/types';
import { useSettingsStore } from '@/state/settingsStore';
import { useToastStore } from '@/state/toastStore';

import { completeOnboarding } from './onboarding';

// 저장소 함수만 가짜로 바꿔, 저장이 중간에 실패했을 때 온보딩이 끝난 것으로 적히지 않는지 본다.
vi.mock('@/db/settingsRepo', () => ({ loadSettings: vi.fn(), saveSetting: vi.fn() }));

const mockedSave = vi.mocked(saveSetting);
const CHOICE = { weeklyGoal: 4, reminderTime: '07:30' };

beforeEach(() => {
  mockedSave.mockReset();
  mockedSave.mockResolvedValue(undefined);
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, status: 'ready' });
  useToastStore.setState({ message: null, seq: 0 });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('온보딩 끝내기', () => {
  it('고른 값을 저장한 뒤에 온보딩 끝을 적는다', async () => {
    expect(await completeOnboarding(CHOICE)).toBe(true);

    expect(mockedSave.mock.calls.map((call) => call[0])).toEqual(['weeklyGoal', 'reminderTime', 'onboardingDone']);
    expect(useSettingsStore.getState().settings).toMatchObject({
      weeklyGoal: 4,
      reminderTime: '07:30',
      onboardingDone: true,
    });
  });

  it('주 목표 저장이 실패하면 거기서 멈추고 온보딩 끝을 적지 않는다', async () => {
    mockedSave.mockRejectedValueOnce(new Error('disk'));

    expect(await completeOnboarding(CHOICE)).toBe(false);

    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().settings.onboardingDone).toBe(false);
    expect(useToastStore.getState().message).not.toBeNull();
  });

  it('알림 시간 저장이 실패해도 온보딩 끝을 적지 않는다', async () => {
    mockedSave.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('disk'));

    expect(await completeOnboarding(CHOICE)).toBe(false);

    expect(mockedSave.mock.calls.map((call) => call[0])).toEqual(['weeklyGoal', 'reminderTime']);
    expect(useSettingsStore.getState().settings).toMatchObject({ weeklyGoal: 4, reminderTime: null, onboardingDone: false });
  });

  it('온보딩 끝 저장이 실패하면 false다(다시 누르면 처음부터 다시 저장한다)', async () => {
    mockedSave.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('disk'));
    expect(await completeOnboarding(CHOICE)).toBe(false);
    expect(useSettingsStore.getState().settings.onboardingDone).toBe(false);

    expect(await completeOnboarding(CHOICE)).toBe(true);
    expect(useSettingsStore.getState().settings.onboardingDone).toBe(true);
  });

  it('알림을 끈 채(null)로도 끝낼 수 있다', async () => {
    expect(await completeOnboarding({ weeklyGoal: 3, reminderTime: null })).toBe(true);
    expect(useSettingsStore.getState().settings).toMatchObject({ reminderTime: null, onboardingDone: true });
  });
});
