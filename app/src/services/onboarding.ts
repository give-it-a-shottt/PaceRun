import type { Settings } from '@/domain/types';
import { useSettingsStore } from '@/state/settingsStore';

type OnboardingChoice = Pick<Settings, 'weeklyGoal' | 'reminderTime'>;

/**
 * 온보딩에서 고른 값을 저장하고 온보딩을 끝낸다. 모두 저장됐으면 true.
 *
 * 설정 저장(`update`)은 실패하면 그 값을 되돌리고 토스트를 띄울 뿐 오류를 던지지 않는다. 그래서 하나씩 저장하고
 * 값이 남아 있는지 확인한다. "온보딩 끝"은 고른 값이 모두 저장된 뒤에만 적는다 — 먼저 적으면
 * 고른 값이 사라진 채로 홈으로 넘어가고, 다음에 앱을 열어도 온보딩이 다시 나오지 않는다.
 */
export async function completeOnboarding(choice: OnboardingChoice): Promise<boolean> {
  return (
    (await saved('weeklyGoal', choice.weeklyGoal)) &&
    (await saved('reminderTime', choice.reminderTime)) &&
    (await saved('onboardingDone', true))
  );
}

async function saved<K extends keyof Settings>(key: K, value: Settings[K]): Promise<boolean> {
  await useSettingsStore.getState().update(key, value);
  return useSettingsStore.getState().settings[key] === value;
}
