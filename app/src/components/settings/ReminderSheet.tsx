import { useRef, useState } from 'react';

import { reminderChoiceOf, reminderTimeOf, type ReminderChoice } from '@/domain/settingsView';
import { requestNotificationAccess } from '@/services/permissions';
import { useSettingsStore } from '@/state/settingsStore';

import { ReminderFields } from './ReminderFields';
import { SettingsSheet, type SettingsSheetProps } from './SettingsSheet';

type Props = SettingsSheetProps & {
  /** 알림 권한 창을 띄운 뒤. 화면이 권한을 다시 확인해 안내를 맞춘다. */
  onNotificationsAsked: () => void;
};

/** 알림 시간(켜기/끄기 + 시 · 분)을 고치는 시트. 바꿀 때마다 바로 저장한다. */
export function ReminderSheet({ visible, ...rest }: Props) {
  // 열 때마다 저장된 값으로 다시 채우도록, 열려 있는 동안에만 내용을 만든다
  return visible ? <OpenSheet {...rest} /> : null;
}

function OpenSheet({ onClose, onNotificationsAsked }: Omit<Props, 'visible'>) {
  const reminderTime = useSettingsStore((s) => s.settings.reminderTime);
  const update = useSettingsStore((s) => s.update);

  const saved = reminderChoiceOf(reminderTime);
  // 끄면 저장 값이 null이 되어 시각이 사라진다. 다시 켤 때 보여 주려고 고르던 시각을 시트가 들고 있는다.
  const [lastClock, setLastClock] = useState(saved.clock);
  // 켜져 있는 동안에는 저장된 값을 그대로 보여 준다(저장에 실패해 되돌아간 값도 그대로 보이게)
  const choice: ReminderChoice = saved.enabled ? saved : { enabled: false, clock: lastClock };

  // 권한 창이 떠 있는 사이에 한 번 더 눌려도 두 번 묻지 않게 한다
  const askingRef = useRef(false);

  const change = async (next: ReminderChoice) => {
    if (askingRef.current) return;
    setLastClock(next.clock);

    if (next.enabled && !choice.enabled) {
      // 저장하면 바로 알림이 예약되므로 그 전에 권한을 묻는다(이미 있으면 창이 뜨지 않는다). 거부해도 켠 채로 저장한다.
      askingRef.current = true;
      try {
        await requestNotificationAccess();
      } catch (error) {
        console.warn('[settings] 알림 권한을 요청하지 못했어요', error);
      } finally {
        askingRef.current = false;
      }
      onNotificationsAsked();
    }

    void update('reminderTime', reminderTimeOf(next));
  };

  return (
    <SettingsSheet visible title="알림 시간" onClose={onClose} doneButton>
      <ReminderFields value={choice} onChange={(next) => void change(next)} />
    </SettingsSheet>
  );
}
