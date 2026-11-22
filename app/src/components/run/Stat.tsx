import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { space } from '@/theme/tokens';

/** 지표 한 칸: 값 + 라벨. */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View accessible accessibilityLabel={`${label} ${value}`} style={styles.stat}>
      <AppText variant="headline24SB" tabular numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption12R" color="textSub" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** 지표를 같은 너비로 나란히 놓는 줄(러닝 중 2칸, 완료 요약 3칸). */
export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'stretch', gap: space[4] },
  stat: { flex: 1, gap: space[0.5] },
});
