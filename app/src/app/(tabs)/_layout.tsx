import { Tabs } from 'expo-router/js-tabs';

import { DockBar } from '@/components/DockBar';

/** 하단 탭 4개: 홈 · 계획 · 기록 · 내 정보. 탭 순서는 여기 적은 순서다. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <DockBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="records" />
      <Tabs.Screen name="my" />
    </Tabs>
  );
}
