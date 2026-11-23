import { canStepDefaultCadence, stepDefaultCadence } from '@/domain/settingsView';
import { useSettingsStore } from '@/state/settingsStore';

import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet';
import { FieldPanel, StepField } from './StepField';

type Props = SettingsSheetProps & {
  /** 지금 값을 보여 줄 글자("분당 170걸음"). 설정 행에 보이는 것과 같은 글자를 받는다. */
  valueText: string;
};

/** 기본 발걸음 박자를 − / + 로 한 칸씩 고치는 시트. 누를 때마다 바로 저장한다. */
export function CadenceSheet({ visible, onClose, valueText }: Props) {
  const spm = useSettingsStore((s) => s.settings.defaultCadenceSpm);
  const update = useSettingsStore((s) => s.update);

  const step = (direction: 1 | -1) => void update('defaultCadenceSpm', stepDefaultCadence(spm, direction));

  return (
    <SettingsSheet visible={visible} title="기본 발걸음 박자" onClose={onClose} doneButton>
      <FieldPanel>
        <StepField
          label="발걸음 박자"
          valueText={valueText}
          canDecrease={canStepDefaultCadence(spm, -1)}
          canIncrease={canStepDefaultCadence(spm, 1)}
          onDecrease={() => step(-1)}
          onIncrease={() => step(1)}
        />
      </FieldPanel>
    </SettingsSheet>
  );
}
