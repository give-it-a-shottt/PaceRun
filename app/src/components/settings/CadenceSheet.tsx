import { FieldPanel, StepField } from '@/components/StepField';
import { canStepDefaultCadence, defaultCadenceText, stepDefaultCadence } from '@/domain/settingsView';
import { useSettingsStore } from '@/state/settingsStore';

import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet';

/** 기본 발걸음 박자를 − / + 로 한 칸씩 고치는 시트. 누를 때마다 바로 저장한다. */
export function CadenceSheet({ visible, onClose }: SettingsSheetProps) {
  const spm = useSettingsStore((s) => s.settings.defaultCadenceSpm);
  const update = useSettingsStore((s) => s.update);

  const step = (direction: 1 | -1) => void update('defaultCadenceSpm', stepDefaultCadence(spm, direction));

  return (
    <SettingsSheet visible={visible} title="기본 발걸음 박자" onClose={onClose} doneButton>
      <FieldPanel>
        <StepField
          label="발걸음 박자"
          valueText={defaultCadenceText(spm)}
          canDecrease={canStepDefaultCadence(spm, -1)}
          canIncrease={canStepDefaultCadence(spm, 1)}
          onDecrease={() => step(-1)}
          onIncrease={() => step(1)}
        />
      </FieldPanel>
    </SettingsSheet>
  );
}
