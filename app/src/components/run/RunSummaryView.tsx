import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { formatDistanceKm, formatDuration, formatPace } from '@/domain/format';
import { MODE_LABEL } from '@/domain/runView';
import type { RunRecord } from '@/services/runHistory';
import { layout, space } from '@/theme/tokens';

import { Stat, StatRow } from './Stat';

type Props = {
  record: RunRecord;
  /** 맨 위 "지난번 비교" 한 줄 */
  comparison?: ReactNode;
  /** 지표 아래 작은 지도 */
  routeMap?: ReactNode;
  /** 맨 아래 이번 주 칸 */
  week?: ReactNode;
};

/** 완료 요약의 내용(RUN_01_004). 저장된 기록을 그리기만 한다. */
export function RunSummaryView({ record, comparison, routeMap, week }: Props) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {comparison}

      <AppText variant="headline24SB" accessibilityRole="header">
        {record.planLabel ?? MODE_LABEL[record.mode]}
      </AppText>

      <StatRow>
        <Stat value={`${formatDistanceKm(record.distanceM)} km`} label="거리" />
        <Stat value={formatDuration(record.elapsedMs)} label="시간" />
        <Stat value={formatPace(record.avgPaceSecPerKm)} label="평균 페이스" />
      </StatRow>

      {record.counted ? (
        <AppText variant="title16SB">오늘 1회 인정!</AppText>
      ) : (
        <AppText variant="body15R" color="textSub">
          10분을 채우지 못해 횟수에는 들어가지 않았어요
        </AppText>
      )}

      {routeMap}
      {week}
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
});
