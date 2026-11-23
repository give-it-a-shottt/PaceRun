import { VOICE_INTERVAL_OPTIONS, voiceIntervalText } from '@/domain/settingsView';
import { useSettingsStore } from '@/state/settingsStore';

import { ChoiceList, type Choice } from './ChoiceList';
import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet';

const TITLE = '안내 간격';

const OPTIONS: readonly Choice<number>[] = VOICE_INTERVAL_OPTIONS.map((km) => ({
  value: km,
  label: voiceIntervalText(km),
}));

/** 음성 안내 간격을 고치는 시트. 고르면 바로 저장하고 닫는다. */
export function VoiceIntervalSheet({ visible, onClose }: SettingsSheetProps) {
  const voiceIntervalKm = useSettingsStore((s) => s.settings.voiceIntervalKm);
  const update = useSettingsStore((s) => s.update);

  return (
    <SettingsSheet visible={visible} title={TITLE} onClose={onClose}>
      <ChoiceList
        label={TITLE}
        options={OPTIONS}
        value={voiceIntervalKm}
        onChange={(km) => {
          void update('voiceIntervalKm', km);
          onClose();
        }}
      />
    </SettingsSheet>
  );
}
