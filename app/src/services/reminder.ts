/**
 * 매일 정한 시각에 "오늘 뛸 시간이에요"를 알린다(설정의 알림 시간).
 * 알림은 OS에 예약해 두므로 앱이 꺼져 있어도 온다. 시간이 바뀌면 지우고 다시 예약한다.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';

import { parseReminderTime } from '@/domain/reminderTime';

const CHANNEL_ID = 'reminder';
const NOTIFICATION_ID = 'pacerun-daily-reminder';

export const REMINDER_TITLE = '오늘의 러닝';
export const REMINDER_BODY = '10분만 뛰어도 1회로 인정돼요. 가볍게 나가 볼까요?';

/**
 * 설정의 알림 시간에 맞춰 예약을 다시 건다. time이 null이면 예약을 지운다.
 * 알림 권한이 없으면 예약하지 않고 false를 돌려준다(권한 요청은 화면이 한다).
 * 예약에 실패해도 앱은 그대로 쓸 수 있어야 해서 오류를 삼킨다.
 */
export function syncReminder(time: string | null): Promise<boolean> {
  // 지우기 → 예약을 한 줄로 세운다. 알림 시간을 연달아 바꿔도 마지막에 고른 시각이 마지막에 예약된다.
  const result = queue.then(() => schedule(time));
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

let queue: Promise<void> = Promise.resolve();

async function schedule(time: string | null): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
    const at = parseReminderTime(time);
    if (!at) return false;

    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return false;

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '러닝 알림',
      importance: AndroidImportance.DEFAULT,
    });
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: { title: REMINDER_TITLE, body: REMINDER_BODY },
      trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: at.hour, minute: at.minute, channelId: CHANNEL_ID },
    });
    return true;
  } catch (error) {
    console.warn('[reminder] 알림을 예약하지 못했어요', error);
    return false;
  }
}
