/** 러닝에 필요한 권한과 기기 설정을 확인 · 요청한다. 화면은 여기 함수만 부른다. */
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export type LocationAccess = {
  /** 위치(앱 사용 중) 권한. 없으면 러닝을 기록할 수 없다. */
  foreground: boolean;
  /** 위치(항상 허용) 권한. 없어도 기록은 되지만 기기에 따라 화면이 꺼지면 끊길 수 있다. */
  background: boolean;
  /** 폰의 위치 서비스(GPS)가 켜져 있는지 */
  servicesEnabled: boolean;
};

export async function getLocationAccess(): Promise<LocationAccess> {
  const [foreground, background, servicesEnabled] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
  ]);
  return { foreground: foreground.granted, background: background.granted, servicesEnabled };
}

/** 위치 권한을 순서대로 요청한다(안드로이드는 '앱 사용 중'을 먼저 받아야 '항상 허용'을 물을 수 있다). */
export async function requestLocationAccess(): Promise<LocationAccess> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.granted) {
    await Location.requestBackgroundPermissionsAsync();
  }
  return getLocationAccess();
}

export async function requestNotificationAccess(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** 배터리 최적화가 켜져 있으면(true) 화면이 꺼졌을 때 기록이 끊길 수 있다. 확인할 수 없으면 false로 본다. */
export async function isBatteryOptimized(): Promise<boolean> {
  try {
    return await Battery.isBatteryOptimizationEnabledAsync();
  } catch {
    return false;
  }
}

/** 배터리 최적화 예외 목록 화면을 연다. 사용자가 목록에서 이 앱을 '제한 없음'으로 바꾼다. */
export async function openBatterySettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  } catch {
    // 기기에 그 화면이 없으면 앱 설정 화면으로 보낸다
    await Linking.openSettings();
  }
}

/** 폰의 위치(GPS) 스위치가 있는 설정 화면을 연다. 앱 설정 화면에는 그 스위치가 없다. */
export async function openLocationSettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS);
  } catch {
    await Linking.openSettings();
  }
}

/** 권한을 '다시 묻지 않음'으로 거절한 경우 앱 설정 화면에서 직접 켜야 한다. */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}
