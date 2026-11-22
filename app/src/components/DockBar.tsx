import type { BottomTabBarProps } from 'expo-router/js-tabs';
import {
  CalendarBlankIcon,
  ChartBarIcon,
  HouseIcon,
  UserIcon,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

import { AppText } from './AppText';

const TABS: Record<string, { label: string; icon: ComponentType<IconProps> }> = {
  home: { label: '홈', icon: HouseIcon },
  plan: { label: '계획', icon: CalendarBlankIcon },
  records: { label: '기록', icon: ChartBarIcon },
  my: { label: '내 정보', icon: UserIcon },
};

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
        const tab = TABS[route.name];
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
            <Icon size={24} color={colors.iconMain} weight={focused ? 'fill' : 'regular'} />
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
