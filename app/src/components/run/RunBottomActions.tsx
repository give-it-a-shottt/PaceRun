import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, space } from '@/theme/tokens';

/** 러닝 화면 하단 버튼 영역. 버튼이 여러 개면 세로로 쌓는다. */
export function RunBottomActions({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  // 제스처 바는 34로 충분하지만, 3버튼 내비게이션 바는 더 높아서 버튼이 가려지지 않게 넓힌다
  const paddingBottom = Math.max(layout.bottomSafePadding, insets.bottom + space[2]);

  return <View style={[styles.bar, { paddingBottom }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: { paddingTop: space[4], paddingHorizontal: layout.screenPaddingX, gap: space[2] },
});
