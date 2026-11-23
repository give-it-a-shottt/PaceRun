import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { WeekCells } from '@/components/home/WeekCells';
import { ModeBadge } from '@/components/ModeBadge';
import { ComparisonBox } from '@/components/records/ComparisonBox';
import { RouteMap } from '@/components/records/RouteMap';
import type { RoutePosition, SummaryView } from '@/services/recordsData';
import { layout, space } from '@/theme/tokens';

import { Stat, StatRow } from './Stat';

type Props = {
  view: SummaryView;
  /** 작은 지도에 그릴 경로 */
  route: readonly RoutePosition[];
};

/** 피그마 완료 요약의 작은 지도 높이(8:478) */
const ROUTE_MAP_HEIGHT = 140;

/** 완료 요약의 내용(RUN_01_004): 지난번 비교 → 제목 → 지표 → 작은 지도 → 이번 주 칸. 받은 값을 그리기만 한다. */
export function RunSummaryView({ view, route }: Props) {
  const { week } = view;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {view.comparison ? <ComparisonBox comparison={view.comparison} /> : null}

      <View style={styles.heading}>
        <ModeBadge mode={view.mode} />
        <AppText variant="headline24SB" accessibilityRole="header">
          {view.title}
        </AppText>
        <AppText variant="caption12R" color="textSub">
          {view.dateText}
        </AppText>
      </View>

      <View style={styles.stats}>
        <StatRow>
          {view.stats.map((stat) => (
            <Stat key={stat.label} value={stat.value} label={stat.label} />
          ))}
        </StatRow>
        {/* 인정된 러닝은 아래 이번 주 칸이 알려 준다. 인정되지 않았을 때만 까닭을 적는다. */}
        {view.counted ? null : (
          <AppText variant="body15R" color="textSub">
            {view.countedText}
          </AppText>
        )}
      </View>

      <RouteMap route={route} height={ROUTE_MAP_HEIGHT} />

      <View style={styles.week}>
        <View style={styles.weekHeading}>
          <AppText variant="title16SB" accessibilityRole="header">
            {week.title}
          </AppText>
          {week.note ? <AppText variant="caption12SB">{week.note}</AppText> : null}
        </View>
        <WeekCells cells={week.cells} paintKey={week.paintKey} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[4],
    gap: space[6],
  },
  heading: { gap: space[2] },
  stats: { gap: space[4] },
  week: { gap: space[3] },
  // 글자를 크게 쓰는 폰에서는 두 글이 한 줄에 안 들어갈 수 있어 줄을 바꾼다
  weekHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: space[3],
    rowGap: space[1],
  },
});
