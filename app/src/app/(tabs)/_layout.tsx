import { Tabs } from 'expo-router/js-tabs';

import { DockBar, TABS } from '@/components/DockBar';

/** 하단 탭 4개: 홈 · 계획 · 기록 · 내 정보. 목록과 순서는 DockBar의 TABS 하나로 정한다. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <DockBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
