import { create } from 'zustand';

import { loadSettings, saveSetting } from '@/db/settingsRepo';
import { DEFAULT_SETTINGS, type Settings } from '@/domain/types';

import { showToast } from './toastStore';

export const SETTINGS_LOAD_ERROR = '설정을 불러오지 못했어요.';
export const SETTINGS_SAVE_ERROR = '설정을 저장하지 못했어요. 다시 시도해 주세요.';

type SettingsState = {
  settings: Settings;
  /**
   * loading: 아직 DB에서 읽는 중 / ready: 읽기 성공 / failed: 읽기 실패.
   * ready가 아닐 때의 settings는 기본값이라 화면 분기(예: 첫 실행 여부)에 쓰면 안 된다.
   */
  status: 'loading' | 'ready' | 'failed';
  load: () => Promise<void>;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
};

/** 설정은 화면 여러 곳에서 읽으므로 메모리에 한 벌 두고, 바꿀 때마다 DB에 바로 저장한다. */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  status: 'loading',

  load: async () => {
    set({ status: 'loading' });
    try {
      const settings = await loadSettings();
      set({ settings, status: 'ready' });
    } catch (error) {
      console.warn('[settings] 설정을 읽지 못했어요', error);
      set({ status: 'failed' });
    }
  },

  update: async (key, value) => {
    const previousValue = get().settings[key];
    set((s) => ({ settings: { ...s.settings, [key]: value } }));
    try {
      await saveSetting(key, value);
    } catch (error) {
      console.warn('[settings] 설정을 저장하지 못했어요', key, error);
      // 저장에 실패하면 이 키만 되돌린다. 그 사이 바꾼 다른 키와, 이 키를 다시 바꾼 값은 건드리지 않는다.
      set((s) => ({
        settings: s.settings[key] === value ? { ...s.settings, [key]: previousValue } : s.settings,
      }));
      showToast(SETTINGS_SAVE_ERROR);
    }
  },
}));
