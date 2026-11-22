/** 러닝에 필요한 권한과 기기 설정을 확인 · 요청한다. 화면은 여기 함수만 부른다. */
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export type LocationAccess = {
  /** 위치(앱 사용 중) 권한. 없으면 러닝을 기록할 수 없다. */
  foreground: boolean;
  /** 폰의 위치 서비스(GPS)가 켜져 있는지 */
  servicesEnabled: boolean;
};

export async function getLocationAccess(): Promise<LocationAccess> {
  const [foreground, servicesEnabled] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
  ]);
  return { foreground: foreground.granted, servicesEnabled };
}

/**
 * 위치 권한('앱 사용 중')을 요청한다.
 * '항상 허용'은 요청하지 않는다. 러닝은 알림을 띄운 포그라운드 서비스로 기록해서
 * '앱 사용 중' 권한만으로 화면이 꺼져도 위치를 받는다. 필요 없는 권한은 받지 않는다(Q-007).
 */
export async function requestLocationAccess(): Promise<LocationAccess> {
  await Location.requestForegroundPermissionsAsync();
  return getLocationAccess();
}

export async function requestNotificationAccess(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** optimized = 켜져 있음(화면이 꺼지면 기록이 끊길 수 있다) / unrestricted = 풀려 있음 / unknown = 확인하지 못함 */
export type BatteryOptimization = 'optimized' | 'unrestricted' | 'unknown';

export async function getBatteryOptimization(): Promise<BatteryOptimization> {
  try {
    return (await Battery.isBatteryOptimizationEnabledAsync()) ? 'optimized' : 'unrestricted';
  } catch {
    return 'unknown';
  }
}

/** 배터리 최적화가 켜져 있으면 true. 확인할 수 없으면 false로 본다(확인도 못 했는데 경고를 띄우지 않는다). */
export async function isBatteryOptimized(): Promise<boolean> {
  return (await getBatteryOptimization()) === 'optimized';
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
