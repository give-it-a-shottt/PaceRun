import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { CalendarBlankIcon, ChartBarIcon, HouseIcon, UserIcon, type IconProps } from './icons';

type Tab = { name: string; label: string; icon: ComponentType<IconProps> };

/**
 * 하단 탭 목록. 탭 레이아웃((tabs)/_layout.tsx)도 이 목록으로 화면을 등록하므로
 * 탭을 더하거나 순서를 바꿀 때는 여기만 고친다. name은 (tabs) 폴더의 파일 이름이다.
 */
export const TABS: readonly Tab[] = [
  { name: 'home', label: '홈', icon: HouseIcon },
  { name: 'plan', label: '계획', icon: CalendarBlankIcon },
  { name: 'records', label: '기록', icon: ChartBarIcon },
  { name: 'my', label: '내 정보', icon: UserIcon },
];

const TAB_ICON_SIZE = 24;

/** 하단 Dock Bar: 탭 4개(글자 있음). 선택된 탭은 채운 아이콘 + SemiBold. */
export function DockBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bgDefault,
          paddingBottom: Math.max(insets.bottom, layout.bottomSafePadding),
        },
      ]}>
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === index;
        const Icon = tab.icon;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.tab}>
            <Icon size={TAB_ICON_SIZE} color={colors.iconMain} weight={focused ? 'fill' : 'regular'} />
            <AppText variant={focused ? 'caption11SB' : 'caption11M'} color={focused ? 'textMain' : 'textSub'}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // 피그마 Shadow/Dock (0, -4, 8, #0000000A)
    boxShadow: '0px -4px 8px rgba(0, 0, 0, 0.04)',
  },
  tab: {
    flex: 1,
    height: layout.dockTabHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
});
