import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';

type Props = {
  children: ReactNode;
  /** 내용이 길어질 수 있는 화면은 스크롤을 켠다. */
  scroll?: boolean;
  /** 탭 화면은 Dock Bar가 아래 여백을 처리하므로 top만 준다. */
  edges?: Edge[];
};

/** 화면 바탕색과 안전 영역을 맞추는 껍데기. */
export function Screen({ children, scroll, edges = ['top'] }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.bgDefault }]}>
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
