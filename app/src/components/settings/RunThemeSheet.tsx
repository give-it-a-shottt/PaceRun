import { RUN_THEME_OPTIONS } from '@/domain/settingsView';
import { useSettingsStore } from '@/state/settingsStore';

import { ChoiceList } from './ChoiceList';
import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet';

const TITLE = '러닝 화면 테마';

/** 러닝 화면 테마(자동 / 항상 밝게)를 고치는 시트. 고르면 바로 저장하고 닫는다. */
export function RunThemeSheet({ visible, onClose }: SettingsSheetProps) {
  const runTheme = useSettingsStore((s) => s.settings.runTheme);
  const update = useSettingsStore((s) => s.update);

  return (
    <SettingsSheet visible={visible} title={TITLE} onClose={onClose}>
      <ChoiceList
        label={TITLE}
        options={RUN_THEME_OPTIONS}
        value={runTheme}
        onChange={(theme) => {
          void update('runTheme', theme);
          onClose();
        }}
      />
    </SettingsSheet>
  );
}
