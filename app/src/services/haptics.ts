import * as Haptics from 'expo-haptics';

/** 길게 누르기의 시작 · 끝 진동. 진동이 실패해도 동작에는 영향이 없어 오류를 삼킨다. */
export function vibrate(kind: 'start' | 'done'): void {
  const run =
    kind === 'start'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  run.catch(() => undefined);
}
