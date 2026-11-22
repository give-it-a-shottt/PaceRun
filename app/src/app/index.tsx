import { Redirect } from 'expo-router';

import { useSettingsStore } from '@/state/settingsStore';

/**
 * 앱의 첫 주소. 첫 실행(온보딩을 마치지 않음)이면 온보딩으로, 아니면 홈으로 보낸다.
 * 루트 레이아웃이 설정을 다 읽은 뒤에만 이 화면을 그리므로 여기서는 읽은 값만 보면 된다.
 */
export default function Index() {
  const onboardingDone = useSettingsStore((s) => s.settings.onboardingDone);
  return <Redirect href={onboardingDone ? '/home' : '/onboarding'} />;
}
