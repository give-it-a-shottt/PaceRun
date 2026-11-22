import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 알림 모듈을 가짜로 바꿔 "언제 예약하고 언제 지우는지"와 실패했을 때의 처리를 본다.
vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  cancelScheduledNotificationAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
}));

/** 모듈 안에 "지금 맞춰 둔 시간"을 기억하므로 테스트마다 새로 불러온다. */
async function setup(options: { granted?: boolean } = {}) {
  vi.resetModules();
  const notifications = vi.mocked(await import('expo-notifications'));
  for (const mock of [
    notifications.cancelScheduledNotificationAsync,
    notifications.getPermissionsAsync,
    notifications.setNotificationChannelAsync,
    notifications.scheduleNotificationAsync,
  ]) {
    mock.mockReset();
  }
  notifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  notifications.getPermissionsAsync.mockResolvedValue({ granted: options.granted ?? true } as never);
  notifications.setNotificationChannelAsync.mockResolvedValue(null);
  notifications.scheduleNotificationAsync.mockResolvedValue('pacerun-daily-reminder');
  const { syncReminder } = await import('./reminder');
  return { notifications, syncReminder };
}

/** 예약 요청에 담긴 시각들 */
function scheduledTimes(notifications: { scheduleNotificationAsync: { mock: { calls: unknown[][] } } }) {
  return notifications.scheduleNotificationAsync.mock.calls.map((call) => {
    const trigger = (call[0] as { trigger: { hour: number; minute: number } }).trigger;
    return `${trigger.hour}:${trigger.minute}`;
  });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('매일 알림 예약', () => {
  it('알림 시간이 있으면 매일 그 시각으로 예약한다', async () => {
    const { notifications, syncReminder } = await setup();

    expect(await syncReminder('07:30')).toBe(true);

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'pacerun-daily-reminder',
      content: { title: '오늘의 러닝', body: expect.any(String) },
      trigger: { type: 'daily', hour: 7, minute: 30, channelId: 'reminder' },
    });
  });

  it('알림을 끄면(null) 예약을 지우고 새로 걸지 않는다', async () => {
    const { notifications, syncReminder } = await setup();

    expect(await syncReminder(null)).toBe(false);

    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('pacerun-daily-reminder');
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('모양이 틀린 시간은 끈 것으로 본다', async () => {
    const { notifications, syncReminder } = await setup();
    expect(await syncReminder('25:00')).toBe(false);
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('알림 권한이 없으면 예약하지 않고, 권한이 생긴 뒤 다시 부르면 예약한다', async () => {
    const { notifications, syncReminder } = await setup({ granted: false });

    expect(await syncReminder('07:30')).toBe(false);
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    // 폰 설정에서 권한을 켜고 앱으로 돌아왔다
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
    expect(await syncReminder('07:30')).toBe(true);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('이미 그 시각으로 맞춰져 있으면 폰에 다시 요청하지 않는다(앱으로 돌아올 때마다 불린다)', async () => {
    const { notifications, syncReminder } = await setup();
    await syncReminder('07:30');
    notifications.getPermissionsAsync.mockClear();

    expect(await syncReminder('07:30')).toBe(true);
    expect(await syncReminder('07:30')).toBe(true);

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('시간을 바꾸면 새 시각으로 다시 예약한다(먼저 지우지 않고 같은 이름으로 바꿔 넣는다)', async () => {
    const { notifications, syncReminder } = await setup();
    await syncReminder('07:30');
    await syncReminder('19:00');

    expect(scheduledTimes(notifications)).toEqual(['7:30', '19:0']);
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('예약이 실패해도 오류를 던지지 않고 false를 돌려주며, 다음에 다시 시도한다', async () => {
    const { notifications, syncReminder } = await setup();
    notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('alarm'));

    await expect(syncReminder('07:30')).resolves.toBe(false);
    await expect(syncReminder('07:30')).resolves.toBe(true);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('지우기가 실패해도 오류를 던지지 않는다', async () => {
    const { notifications, syncReminder } = await setup();
    notifications.cancelScheduledNotificationAsync.mockRejectedValue(new Error('busy'));
    await expect(syncReminder(null)).resolves.toBe(false);
  });

  it('연달아 불러도 부른 순서대로 처리해, 마지막에 고른 시각이 마지막에 예약된다', async () => {
    const { notifications, syncReminder } = await setup();
    // 첫 예약이 오래 걸리는 동안 시간을 두 번 더 바꾼다
    let finishFirst: (id: string) => void = () => {};
    notifications.scheduleNotificationAsync.mockReturnValueOnce(new Promise<string>((resolve) => (finishFirst = resolve)));

    const first = syncReminder('07:00');
    const second = syncReminder('07:10');
    const third = syncReminder('07:20');
    await Promise.resolve();
    finishFirst('pacerun-daily-reminder');
    await Promise.all([first, second, third]);

    expect(scheduledTimes(notifications)).toEqual(['7:0', '7:10', '7:20']);
  });

  it('끈 뒤 다시 켜면 다시 예약한다', async () => {
    const { notifications, syncReminder } = await setup();
    await syncReminder('07:30');
    await syncReminder(null);
    await syncReminder('07:30');
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
