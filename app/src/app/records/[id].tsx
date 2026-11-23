import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ModeBadge } from '@/components/ModeBadge';
import { ComparisonBox } from '@/components/records/ComparisonBox';
import { RouteMap } from '@/components/records/RouteMap';
import { SegmentTable } from '@/components/records/SegmentTable';
import { Stat, StatRow } from '@/components/run/Stat';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { useLoadedValue } from '@/components/useLoadedValue';
import { loadRunDetailView, type RoutePosition, type RunDetailView, type StatView } from '@/services/recordsData';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

/** 피그마 러닝 상세의 작은 지도 높이(11:1248) */
const ROUTE_MAP_HEIGHT = 180;
/** 지표는 한 줄에 두 칸씩 놓는다(`6'02"/km`처럼 긴 값이 세 칸에는 들어가지 않는다) */
const STATS_PER_ROW = 2;

/** 주소로 바로 들어와 돌아갈 화면이 없으면 기록 탭으로 간다 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/records');
}

/** 러닝 상세(REC_01_002): 지난번 비교 · 작은 지도 · 지표 · 구간 기록. */
export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => loadRunDetailView(id), [id]);
  const { state, retry } = useLoadedValue(load, 'records');

  return (
    <Screen>
      <TopBar variant="back" title={state.status === 'ready' ? state.value.view.headerTitle : undefined} onBack={goBack} />

      {state.status === 'ready' ? <RunDetail view={state.value.view} route={state.value.route} /> : null}
      {/* 폰 안의 DB라 금방 읽힌다. 깜빡이지 않게 읽는 동안은 비워 둔다. */}
      {state.status === 'missing' ? (
        <View style={styles.message}>
          <AppText variant="title18SB">기록을 찾지 못했어요</AppText>
        </View>
      ) : null}
      {state.status === 'failed' ? (
        <View style={styles.message}>
          <AppText variant="title18SB">기록을 불러오지 못했어요</AppText>
          <AppText color="textSub">잠시 뒤 다시 시도해 주세요.</AppText>
          <Button label="다시 시도" variant="outlineStrong" onPress={retry} style={styles.retry} />
        </View>
      ) : null}
    </Screen>
  );
}

function RunDetail({ view, route }: { view: RunDetailView; route: RoutePosition[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const statRows: StatView[][] = [];
  for (let index = 0; index < view.stats.length; index += STATS_PER_ROW) {
    statRows.push(view.stats.slice(index, index + STATS_PER_ROW));
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: insets.bottom }}>
      <View style={styles.summary}>
        {view.comparison ? <ComparisonBox comparison={view.comparison} /> : null}

        <View style={styles.heading}>
          <ModeBadge mode={view.mode} />
          <AppText variant="headline24SB" accessibilityRole="header">
            {view.title}
          </AppText>
          <AppText variant="caption12R" color="textSub">
            {view.timeText}
          </AppText>
        </View>

        <RouteMap route={route} height={ROUTE_MAP_HEIGHT} />

        <View style={styles.stats}>
          {statRows.map((row) => (
            <StatRow key={row[0].label}>
              {row.map((stat) => (
                <Stat key={stat.label} value={stat.value} label={stat.label} />
              ))}
              {/* 마지막 줄이 한 칸뿐이어도 칸 너비가 윗줄과 같게 빈 칸을 둔다 */}
              {row.length < STATS_PER_ROW ? <View style={styles.flex} /> : null}
            </StatRow>
          ))}
          {view.note ? (
            <AppText variant="body15R" color="textSub">
              {view.note}
            </AppText>
          ) : null}
        </View>
      </View>

      {view.segments.length > 0 ? (
        <>
          <View style={[styles.band, { backgroundColor: colors.bgRegular }]} />
          <View style={styles.segments}>
            <AppText variant="title18SB" accessibilityRole="header">
              구간 기록
            </AppText>
            <SegmentTable segments={view.segments} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  message: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.screenPaddingX, gap: space[2] },
  retry: { marginTop: space[4] },
  summary: {
    paddingTop: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[6],
    gap: space[6],
  },
  heading: { gap: space[2] },
  stats: { gap: space[4] },
  band: { height: space[3] },
  segments: { paddingHorizontal: layout.screenPaddingX, paddingVertical: space[6], gap: space[2] },
});
