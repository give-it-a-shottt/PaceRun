import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as Notifications from 'expo-notifications';

import { getNotificationAccess, requestNotificationAccess } from './permissions';

// 폰의 기능 모듈은 테스트에서 돌지 않으므로 가짜로 바꾼다. 여기서는 알림 권한 확인만 본다.
vi.mock('expo-battery', () => ({}));
vi.mock('expo-intent-launcher', () => ({}));
vi.mock('expo-location', () => ({}));
vi.mock('expo-notifications', () => ({ getPermissionsAsync: vi.fn(), requestPermissionsAsync: vi.fn() }));
vi.mock('react-native', () => ({ Linking: {} }));

const getPermissions = vi.mocked(Notifications.getPermissionsAsync);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('알림 권한 확인', () => {
  it('권한이 있으면 granted, 없으면 denied를 돌려준다', async () => {
    getPermissions.mockResolvedValue({ granted: true } as never);
    expect(await getNotificationAccess()).toBe('granted');

    getPermissions.mockResolvedValue({ granted: false } as never);
    expect(await getNotificationAccess()).toBe('denied');
  });

  it('확인하다 오류가 나면 던지지 않고 unknown을 돌려준다(안내를 띄우지 않는 쪽)', async () => {
    getPermissions.mockRejectedValue(new Error('no module'));
    expect(await getNotificationAccess()).toBe('unknown');
  });

  it('확인만 하고 권한 창은 띄우지 않는다', async () => {
    getPermissions.mockResolvedValue({ granted: false } as never);
    await getNotificationAccess();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('알림 권한 요청', () => {
  it('이미 있으면 창을 띄우지 않고 true', async () => {
    getPermissions.mockResolvedValue({ granted: true } as never);
    expect(await requestNotificationAccess()).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('없으면 창을 띄우고 그 결과를 돌려준다', async () => {
    getPermissions.mockResolvedValue({ granted: false } as never);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: false } as never);
    expect(await requestNotificationAccess()).toBe(false);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('요청하다 오류가 나도 던지지 않고 false를 돌려준다', async () => {
    getPermissions.mockRejectedValue(new Error('no module'));
    await expect(requestNotificationAccess()).resolves.toBe(false);
  });
});
