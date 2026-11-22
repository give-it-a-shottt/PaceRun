import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ArrowsClockwiseIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

type Props = {
  /** "11월 17일 – 23일" */
  rangeText: string;
  /** "주 3회 · 약 60분" */
  summaryText: string;
  onChangeTemplate: () => void;
};

const ICON_SIZE = 16;

/** 주간 계획 맨 위: 이번 주 날짜 범위 · 주 합계와 [템플릿 바꾸기] */
export function PlanSummary({ rangeText, summaryText, onChangeTemplate }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <View style={styles.text}>
        <AppText variant="caption12R" color="textSub">
          {rangeText}
        </AppText>
        <AppText variant="headline20SB" accessibilityRole="header">
          {summaryText}
        </AppText>
      </View>
      {/* 공용 Button(L 48 · XL 56)보다 작은 버튼이라 여기서만 따로 그린다 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="템플릿 바꾸기"
        // 보이는 높이가 낮아서 누르는 영역을 위아래로 넓힌다
        hitSlop={space[2]}
        onPress={onChangeTemplate}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.lineBlack, backgroundColor: pressed ? colors.bgRegular : colors.bgDefault },
        ]}>
        <ArrowsClockwiseIcon size={ICON_SIZE} color={colors.iconMain} />
        <AppText variant="caption12SB">템플릿 바꾸기</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  text: { flexShrink: 1, gap: space[0.5] },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3] - 1,
    paddingVertical: space[2] - 1,
    borderWidth: 1,
    borderRadius: radius.button,
  },
});
