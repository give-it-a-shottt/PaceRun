/**
 * 잠금화면 · 알림 창의 [일시정지] / [재개] 버튼.
 * 위치 기록용 알림(expo-location이 띄움)에는 버튼을 달 수 없어서, 버튼이 달린 알림을 하나 더 띄운다.
 * 버튼을 눌렀을 때 화면이 꺼진 상태에서도 반응하는지는 실기기에서 확인해야 한다(STATUS "내가 할 일").
 */
import * as Notifications from 'expo-notifications';
// 열거형은 이름으로 따로 가져온다(린트가 네임스페이스 안의 열거형을 찾지 못한다)
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

const CHANNEL_ID = 'run-control';
const NOTIFICATION_ID = 'pacerun-run-control';
const CATEGORY_RUNNING = 'pacerun-running';
const CATEGORY_PAUSED = 'pacerun-paused';
const ACTION_PAUSE = 'pacerun-pause';
const ACTION_RESUME = 'pacerun-resume';

type Handlers = { onPause: () => void; onResume: () => void };

let subscription: Notifications.EventSubscription | null = null;
let prepared = false;

/** 채널과 버튼 묶음을 한 번 등록한다. 여러 번 불러도 된다. */
async function prepare(): Promise<void> {
  if (prepared) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '러닝 조작',
    // 소리 · 진동 없이 조용히 떠 있게 한다
    importance: AndroidImportance.LOW,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationCategoryAsync(CATEGORY_RUNNING, [
    { identifier: ACTION_PAUSE, buttonTitle: '일시정지', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_PAUSED, [
    { identifier: ACTION_RESUME, buttonTitle: '재개', options: { opensAppToForeground: false } },
  ]);
  prepared = true;
}

/**
 * 러닝을 시작하거나 다시 이어 붙을 때 부른다. 알림 버튼을 누르면 handlers가 불린다.
 * 이어 붙는 러닝이 일시정지 중이면 paused로 [재개] 버튼을 띄운다.
 */
export async function startRunControl(handlers: Handlers, paused = false): Promise<void> {
  subscription?.remove();
  subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.identifier !== NOTIFICATION_ID) return;
    if (response.actionIdentifier === ACTION_PAUSE) handlers.onPause();
    if (response.actionIdentifier === ACTION_RESUME) handlers.onResume();
  });
  await showRunControl(paused);
}

/** 상태가 바뀔 때마다 부른다. 같은 번호로 다시 띄워 버튼만 바꾼다. */
export async function showRunControl(paused: boolean): Promise<void> {
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    // 알림 권한이 없으면 버튼 없이 진행한다(화면의 버튼으로 조작할 수 있다)
    if (!granted) return;
    await prepare();
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'Pace Run',
        body: paused ? '일시정지 중이에요' : '러닝을 기록하고 있어요',
        categoryIdentifier: paused ? CATEGORY_PAUSED : CATEGORY_RUNNING,
        sticky: true,
        autoDismiss: false,
      },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch (error) {
    console.warn('[runNotification] 조작 알림을 띄우지 못했어요', error);
  }
}

/** 러닝이 끝나면 부른다. */
export async function stopRunControl(): Promise<void> {
  subscription?.remove();
  subscription = null;
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch (error) {
    console.warn('[runNotification] 조작 알림을 지우지 못했어요', error);
  }
}
