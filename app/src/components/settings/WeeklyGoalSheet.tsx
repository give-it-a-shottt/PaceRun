import { useSettingsStore } from '@/state/settingsStore';

import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet';
import { WeeklyGoalPicker } from './WeeklyGoalPicker';

/** 주 목표 횟수를 고치는 시트. 고르면 바로 저장하고 닫는다. */
export function WeeklyGoalSheet({ visible, onClose }: SettingsSheetProps) {
  const weeklyGoal = useSettingsStore((s) => s.settings.weeklyGoal);
  const update = useSettingsStore((s) => s.update);

  return (
    <SettingsSheet visible={visible} title="주 목표" onClose={onClose}>
      <WeeklyGoalPicker
        value={weeklyGoal}
        onChange={(goal) => {
          void update('weeklyGoal', goal);
          onClose();
        }}
      />
    </SettingsSheet>
  );
}
