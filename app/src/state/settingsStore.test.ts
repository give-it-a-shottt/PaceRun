import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadSettings, saveSetting } from '@/db/settingsRepo';
import { DEFAULT_SETTINGS } from '@/domain/types';

import { SETTINGS_SAVE_ERROR, useSettingsStore } from './settingsStore';
import { useToastStore } from './toastStore';

// DB(expo-sqlite)는 폰에서만 돌므로 저장소 함수만 가짜로 바꿔, 저장소가 성공·실패할 때 store가 어떻게 하는지 본다.
// (vitest가 vi.mock을 import보다 먼저 실행되도록 끌어올린다)
vi.mock('@/db/settingsRepo', () => ({
  loadSettings: vi.fn(),
  saveSetting: vi.fn(),
}));

const mockedLoad = vi.mocked(loadSettings);
const mockedSave = vi.mocked(saveSetting);

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, status: 'loading' });
  useToastStore.setState({ message: null, seq: 0 });
});

describe('load', () => {
  it('읽기에 성공하면 값을 채우고 ready가 된다', async () => {
    mockedLoad.mockResolvedValue({ ...DEFAULT_SETTINGS, weeklyGoal: 5, onboardingDone: true });
    await useSettingsStore.getState().load();
    const { status, settings } = useSettingsStore.getState();
    expect(status).toBe('ready');
    expect(settings.weeklyGoal).toBe(5);
    expect(settings.onboardingDone).toBe(true);
  });

  it('읽기에 실패하면 ready가 아니라 failed가 된다(기본값으로 진행하지 않는다)', async () => {
    mockedLoad.mockRejectedValue(new Error('disk'));
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().status).toBe('failed');
  });

  it('실패한 뒤 다시 시도해 성공하면 ready가 된다', async () => {
    mockedLoad.mockRejectedValueOnce(new Error('disk')).mockResolvedValueOnce(DEFAULT_SETTINGS);
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().status).toBe('ready');
  });
});

describe('update', () => {
  it('화면 값을 바로 바꾸고 DB에 저장한다', async () => {
    mockedSave.mockResolvedValue(undefined);
    await useSettingsStore.getState().update('weeklyGoal', 4);
    expect(useSettingsStore.getState().settings.weeklyGoal).toBe(4);
    expect(mockedSave).toHaveBeenCalledWith('weeklyGoal', 4);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('저장에 실패하면 그 값만 되돌리고 토스트로 알린다', async () => {
    mockedSave.mockRejectedValue(new Error('disk'));
    await useSettingsStore.getState().update('weeklyGoal', 4);
    expect(useSettingsStore.getState().settings.weeklyGoal).toBe(DEFAULT_SETTINGS.weeklyGoal);
    expect(useToastStore.getState().message).toBe(SETTINGS_SAVE_ERROR);
  });

  it('앞선 저장이 실패해도 그 사이 바꾼 다른 설정은 사라지지 않는다', async () => {
    let failFirst: (error: Error) => void = () => {};
    mockedSave
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (failFirst = reject)))
      .mockResolvedValueOnce(undefined);

    const first = useSettingsStore.getState().update('weeklyGoal', 4);
    await useSettingsStore.getState().update('voiceEnabled', false);
    failFirst(new Error('disk'));
    await first;

    const { settings } = useSettingsStore.getState();
    expect(settings.weeklyGoal).toBe(DEFAULT_SETTINGS.weeklyGoal);
    expect(settings.voiceEnabled).toBe(false);
  });

  it('실패한 저장보다 나중에 같은 설정을 다시 바꿨으면 그 값을 덮어쓰지 않는다', async () => {
    let failFirst: (error: Error) => void = () => {};
    mockedSave
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (failFirst = reject)))
      .mockResolvedValueOnce(undefined);

    const first = useSettingsStore.getState().update('weeklyGoal', 4);
    await useSettingsStore.getState().update('weeklyGoal', 5);
    failFirst(new Error('disk'));
    await first;

    expect(useSettingsStore.getState().settings.weeklyGoal).toBe(5);
  });
});
