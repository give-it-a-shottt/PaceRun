/**
 * 매일 정한 시각에 "오늘 뛸 시간이에요"를 알린다(설정의 알림 시간).
 * 알림은 OS에 예약해 두므로 앱이 꺼져 있어도 온다. 시간이 바뀌면 다시 예약한다.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';

import { parseReminderTime } from '@/domain/reminderTime';

const CHANNEL_ID = 'reminder';
const NOTIFICATION_ID = 'pacerun-daily-reminder';

export const REMINDER_TITLE = '오늘의 러닝';
export const REMINDER_BODY = '10분만 뛰어도 1회로 인정돼요. 가볍게 나가 볼까요?';

/** 예약을 한 줄로 세운다. 알림 시간을 연달아 바꿔도 마지막에 고른 시각이 마지막에 반영된다. */
let queue: Promise<void> = Promise.resolve();
/**
 * 지금 OS에 맞춰 둔 알림 시간. undefined = 아직 모름(앱을 막 켰거나, 권한이 없거나 실패해서 맞추지 못함).
 * 앱으로 돌아올 때마다 맞추기를 부르는데, 이미 맞춰져 있으면 폰에 다시 요청하지 않으려고 기억해 둔다.
 */
let syncedTime: string | null | undefined;

/**
 * 설정의 알림 시간에 맞춰 예약을 건다. time이 null이면 예약을 지운다.
 * 알림 권한이 없으면 예약하지 않고 false를 돌려준다(권한 요청은 화면이 한다. 권한을 켜고 앱으로 돌아오면 그때 예약된다).
 * 예약에 실패해도 앱은 그대로 쓸 수 있어야 해서 오류를 던지지 않는다.
 */
export function syncReminder(time: string | null): Promise<boolean> {
  const result = queue.then(() => apply(time));
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function apply(time: string | null): Promise<boolean> {
  const at = parseReminderTime(time);
  // 모양이 틀린 값은 끈 것으로 본다
  const wanted = at ? time : null;
  if (syncedTime === wanted) return wanted != null;

  try {
    if (!at) {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
      syncedTime = null;
      return false;
    }

    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      // 권한이 없으면 알림이 올 수 없다. 남아 있던 예약도 지워 둔다. 다음에 다시 확인하도록 "모름"으로 둔다.
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
      syncedTime = undefined;
      return false;
    }

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '러닝 알림',
      importance: AndroidImportance.DEFAULT,
    });
    // 같은 이름으로 예약하면 있던 예약을 바꿔 넣는다. 먼저 지우지 않는 것은, 예약이 실패했을 때
    // 잘 되던 예약까지 사라지지 않게 하려는 것.
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: { title: REMINDER_TITLE, body: REMINDER_BODY },
      trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: at.hour, minute: at.minute, channelId: CHANNEL_ID },
    });
    syncedTime = wanted;
    return true;
  } catch (error) {
    console.warn('[reminder] 알림을 예약하지 못했어요', error);
    syncedTime = undefined;
    return false;
  }
}
