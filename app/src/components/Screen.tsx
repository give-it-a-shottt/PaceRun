import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';
import type { ColorName } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** 내용이 길어질 수 있는 화면은 스크롤을 켠다. */
  scroll?: boolean;
  /** 탭 화면은 Dock Bar가 아래 여백을 처리하므로 top만 준다. */
  edges?: Edge[];
  /** 화면 바탕색. 기본은 흰색(bg/default)이고, 흰 카드를 올리는 화면(계획 탭)은 bgLight를 준다. */
  background?: ColorName;
};

/** 화면 바탕색과 안전 영역을 맞추는 껍데기. */
export function Screen({ children, scroll, edges = ['top'], background = 'bgDefault' }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors[background] }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
