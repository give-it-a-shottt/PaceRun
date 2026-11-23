import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TrendUpIcon } from '@/components/icons';
import type { ComparisonView } from '@/services/recordsData';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

const ICON_SIZE = 24;

/** "지난번 비교" 상자(완료 요약 · 러닝 상세). 같은 모드 지난 기록과의 페이스 비교 한 줄과 그 근거. */
export function ComparisonBox({ comparison }: { comparison: ComparisonView }) {
  const { colors } = useTheme();

  return (
    // 두 줄을 한 번에 읽어 준다
    <View accessible style={[styles.box, { backgroundColor: colors.sub1Soft, borderColor: colors.lineBlack }]}>
      <TrendUpIcon size={ICON_SIZE} color={colors.iconMain} />
      <View style={styles.text}>
        <AppText variant="title16SB">{comparison.text}</AppText>
        {comparison.detail ? (
          <AppText variant="caption12R" color="textSub">
            {comparison.detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: space[3],
    padding: space[4],
    borderWidth: 1,
    borderRadius: radius.card,
  },
  text: { flex: 1, gap: space[0.5] },
});
