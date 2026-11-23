import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import type { ChartBarView, RecordsChartView } from '@/services/recordsData';
import { useTheme } from '@/theme/ThemeContext';
import { space, typography } from '@/theme/tokens';

// 피그마 Weekly Bar Chart(11:1135)의 값. 차트 크기는 피그마에 변수가 없어 숫자 그대로다.
/** 가장 긴 막대(ratio 1)의 높이 */
const PLOT_HEIGHT = 104;
const BAR_WIDTH = 24;
const BAR_RADIUS = 4;
/** 아주 짧은 거리도 윤곽선에 묻히지 않고 막대로 보이게 한다 */
const BAR_MIN_HEIGHT = 4;
/** 뛰지 않은 날의 바닥 표시 */
const EMPTY_MARK_HEIGHT = 2;
/** 막대와 값, 목표선과 목표 글자 사이 */
const LABEL_GAP = space[0.5];
const LABEL_SPACE = typography.caption11M.lineHeight + LABEL_GAP;
/** 가장 긴 막대의 값 위에 목표 글자가 한 줄 더 들어갈 자리를 남긴다 */
const CHART_HEIGHT = PLOT_HEIGHT + LABEL_SPACE * 2;
const GOAL_DASH = '4 4';

function barHeight(bar: ChartBarView): number {
  return Math.max(BAR_MIN_HEIGHT, Math.round(PLOT_HEIGHT * bar.ratio));
}

/** 이번 주 요일별 거리 막대(월~일) + 목표선. 받은 값을 그리기만 한다. */
export function WeekBarChart({ chart }: { chart: RecordsChartView }) {
  const { colors } = useTheme();
  const { bars, goal } = chart;

  const goalHeight = goal ? Math.round(PLOT_HEIGHT * goal.ratio) : 0;
  // 목표 글자는 선 바로 위 오른쪽 끝(일요일 자리)에 놓인다. 일요일 막대나 그 값이 그 자리까지 올라오면
  // 글자가 겹쳐 읽을 수 없으므로 맨 위 빈 줄로 올린다.
  const lastBar = bars[bars.length - 1];
  const lastBarTop = lastBar?.valueText ? barHeight(lastBar) + LABEL_SPACE : 0;
  const goalTextBottom = (lastBarTop > goalHeight ? PLOT_HEIGHT + LABEL_SPACE : goalHeight) + LABEL_GAP;

  return (
    // 색 · 높이만으로 알리지 않도록 차트 전체를 "월요일 2.4킬로미터, …"처럼 한 번에 읽어 준다
    <View accessible accessibilityRole="image" accessibilityLabel={chart.accessibilityLabel} style={styles.root}>
      <View style={styles.plot}>
        {goal ? (
          <>
            <Svg width="100%" height={1} style={[styles.goalLine, { bottom: goalHeight }]}>
              <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={colors.lineBlack} strokeWidth={1} strokeDasharray={GOAL_DASH} />
            </Svg>
            <AppText variant="caption11SB" style={[styles.goalText, { bottom: goalTextBottom }]}>
              {goal.text}
            </AppText>
          </>
        ) : null}

        <View style={styles.columns}>
          {bars.map((bar) => (
            <View key={bar.label} style={styles.column}>
              {bar.valueText ? (
                <>
                  {/* 목표선이 값 글자를 가로지르지 않게 바탕색을 깐다 */}
                  <AppText
                    variant={bar.isToday ? 'caption11SB' : 'caption11M'}
                    tabular
                    numberOfLines={1}
                    style={[styles.value, { backgroundColor: colors.bgDefault }]}>
                    {bar.valueText}
                  </AppText>
                  <View
                    style={[
                      styles.bar,
                      { height: barHeight(bar), backgroundColor: colors.laneDone, borderColor: colors.lineBlack },
                    ]}
                  />
                </>
              ) : (
                <View style={[styles.emptyMark, { backgroundColor: colors.lineRegular }]} />
              )}
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.baseline, { backgroundColor: colors.lineRegular }]} />

      <View style={styles.days}>
        {bars.map((bar) => (
          <AppText
            key={bar.label}
            variant={bar.isToday ? 'caption12SB' : 'caption12R'}
            color={bar.isToday ? 'textMain' : 'textSub'}
            style={styles.day}>
            {bar.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', paddingBottom: space[2] },
  plot: { height: CHART_HEIGHT },
  goalLine: { position: 'absolute', left: 0, right: 0 },
  goalText: { position: 'absolute', right: 0 },
  columns: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center' },
  value: { marginBottom: LABEL_GAP, paddingHorizontal: space[0.5] },
  bar: {
    width: BAR_WIDTH,
    borderWidth: 1,
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
  },
  emptyMark: { width: BAR_WIDTH, height: EMPTY_MARK_HEIGHT },
  baseline: { height: 1 },
  days: { flexDirection: 'row', marginTop: space[2] },
  day: { flex: 1, textAlign: 'center' },
});
