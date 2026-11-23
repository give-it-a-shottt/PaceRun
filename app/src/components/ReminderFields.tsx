import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Toggle } from '@/components/Toggle';
import { formatReminderHour, formatReminderMinute, stepHour, stepMinute, type ReminderClock } from '@/domain/reminderTime';
import type { ReminderChoice } from '@/domain/settingsView';
import { space } from '@/theme/tokens';

import { FieldPanel, StepField } from './StepField';

const FIELD_HEIGHT = 48;
const TOGGLE_LABEL = '매일 알림 받기';

type Props = {
  value: ReminderChoice;
  onChange: (next: ReminderChoice) => void;
};

/**
 * 알림 시간을 고르는 칸: 켜기/끄기 + 시 · 분. 온보딩 3단계와 설정의 알림 시간 시트가 함께 쓴다.
 * 끄면 시 · 분은 숨기지만 고르던 시각은 value.clock에 그대로 둔다(다시 켜면 보여 준다).
 */
export function ReminderFields({ value, onChange }: Props) {
  const setClock = (clock: ReminderClock) => onChange({ ...value, clock });

  return (
    <FieldPanel>
      <View style={styles.toggleField}>
        <AppText variant="body15R" style={styles.label}>
          {TOGGLE_LABEL}
        </AppText>
        <Toggle label={TOGGLE_LABEL} value={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />
      </View>
      {value.enabled ? (
        <>
          <StepField
            label="시"
            valueText={formatReminderHour(value.clock.hour)}
            onDecrease={() => setClock(stepHour(value.clock, -1))}
            onIncrease={() => setClock(stepHour(value.clock, 1))}
          />
          <StepField
            label="분"
            valueText={formatReminderMinute(value.clock.minute)}
            onDecrease={() => setClock(stepMinute(value.clock, -1))}
            onIncrease={() => setClock(stepMinute(value.clock, 1))}
          />
        </>
      ) : null}
    </FieldPanel>
  );
}

const styles = StyleSheet.create({
  // 스위치는 − / + 버튼처럼 누르는 영역 여백을 갖고 있지 않아서 오른쪽을 맞춰 준다
  toggleField: { height: FIELD_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingRight: space[2] },
  label: { flex: 1 },
});
