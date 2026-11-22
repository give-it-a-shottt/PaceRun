import { create } from 'zustand';

import { loadSettings, saveSetting } from '@/db/settingsRepo';
import { DEFAULT_SETTINGS, type Settings } from '@/domain/types';

type SettingsState = {
  settings: Settings;
  /** DB에서 한 번 읽어 왔는지. 읽기 전에는 기본값이라 화면 분기에 쓰면 안 된다. */
  loaded: boolean;
  /** 마지막 읽기 · 저장이 실패했을 때의 안내 문구 */
  error: string | null;
  load: () => Promise<void>;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
};

/** 설정은 화면 여러 곳에서 읽으므로 메모리에 한 벌 두고, 바꿀 때마다 DB에 바로 저장한다. */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  error: null,

  load: async () => {
    try {
      const settings = await loadSettings();
      set({ settings, loaded: true, error: null });
    } catch {
      set({ loaded: true, error: '설정을 불러오지 못했어요. 앱을 다시 열어 주세요.' });
    }
  },

  update: async (key, value) => {
    const previous = get().settings;
    set({ settings: { ...previous, [key]: value }, error: null });
    try {
      await saveSetting(key, value);
    } catch {
      // 저장에 실패하면 화면 값도 되돌려 "저장된 줄 알았는데 아닌" 상태를 막는다
      set({ settings: previous, error: '설정을 저장하지 못했어요. 다시 시도해 주세요.' });
    }
  },
}));
