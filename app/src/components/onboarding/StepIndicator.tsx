import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

// 피그마 Lane Segment(6:58)를 온보딩 단계 표시로 쓴 값. 모서리 · 테두리 · 채움 너비는 피그마에 변수가 없어 숫자 그대로다.
const CELL_HEIGHT = 12;
const CELL_RADIUS = 2;
const CURRENT_BORDER = 2;
const CURRENT_FILL_WIDTH = 9;

type Props = {
  /** 지금 단계(1부터) */
  step: number;
  total: number;
};

/** 온보딩 단계 표시: 지나온 칸 · 지금 칸(테두리) · 남은 칸 + "1 / 3" */
export function StepIndicator({ step, total }: Props) {
  const { colors } = useTheme();

  return (
    <View accessible accessibilityLabel={`${total}단계 중 ${step}단계`} style={styles.root}>
      <View style={styles.cells}>
        {Array.from({ length: total }, (_, index) => {
          const cellStep = index + 1;

          if (cellStep !== step) {
            const color = cellStep < step ? colors.laneDone : colors.lineLight;
            return <View key={cellStep} style={[styles.cell, { backgroundColor: color }]} />;
          }

          return (
            <View key={cellStep} style={[styles.cell, { backgroundColor: colors.bgDefault }]}>
              <View style={[styles.currentFill, { backgroundColor: colors.laneDone }]} />
              <View style={[styles.currentBorder, { borderColor: colors.lineBlack }]} />
            </View>
          );
        })}
      </View>
      <AppText variant="caption12SB" tabular>
        {step} / {total}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  cells: { flex: 1, flexDirection: 'row', gap: space[1] },
  cell: { flex: 1, height: CELL_HEIGHT, borderRadius: CELL_RADIUS, overflow: 'hidden' },
  currentFill: { position: 'absolute', top: 0, bottom: 0, left: 0, width: CURRENT_FILL_WIDTH },
  // 테두리를 채움 위에 덮어 그린다(피그마에서 선이 칸 안쪽에 있다)
  currentBorder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: CURRENT_BORDER,
    borderRadius: CELL_RADIUS,
  },
});
