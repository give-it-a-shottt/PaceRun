import { router } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RecordsEmpty } from '@/components/records/RecordsEmpty';
import { RunListItem } from '@/components/records/RunListItem';
import { useRecordsView } from '@/components/records/useRecordsView';
import { WeekBarChart } from '@/components/records/WeekBarChart';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import type { RecordsView, RunListItemView } from '@/services/recordsData';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

function openRun(id: string) {
  router.navigate({ pathname: '/records/[id]', params: { id } });
}

const keyOf = (item: RunListItemView) => item.id;

/** 기록 탭: 기록이 있으면 이번 주 막대 + 러닝 목록(REC_01_001), 하나도 없으면 빈 상태(REC_01_003). */
export default function RecordsScreen() {
  const { state: records, reload } = useRecordsView();
  const view = records.view;

  const renderItem = useCallback<ListRenderItem<RunListItemView>>(
    ({ item }) => <RunListItem item={item} onPress={() => openRun(item.id)} />,
    [],
  );

  return (
    <Screen>
      <TopBar variant="title" title="기록" />

      {/* 폰 안의 DB라 금방 읽힌다. 깜빡이지 않게 읽는 동안은 비워 둔다. */}
      {records.status === 'failed' ? (
        <View style={styles.failed}>
          <Card>
            <AppText variant="title18SB">기록을 불러오지 못했어요</AppText>
            <AppText color="textSub">잠시 뒤 다시 시도해 주세요.</AppText>
            <Button label="다시 시도" variant="outlineStrong" onPress={reload} style={styles.retry} />
          </Card>
        </View>
      ) : null}

      {view?.isEmpty ? <RecordsEmpty /> : null}

      {view && !view.isEmpty ? (
        // 기록이 수백 개일 수 있어 보이는 줄만 그린다
        <FlatList
          data={view.items}
          keyExtractor={keyOf}
          renderItem={renderItem}
          ListHeaderComponent={<RecordsHeader view={view} />}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </Screen>
  );
}

/** 목록 위쪽: 이번 주 합계 + 요일별 막대 차트 + "최근 기록" 제목 */
function RecordsHeader({ view }: { view: RecordsView }) {
  const { colors } = useTheme();

  return (
    <View>
      <View style={styles.week}>
        <View style={styles.heading}>
          <AppText variant="caption12R" color="textSub">
            {view.rangeText}
          </AppText>
          <AppText variant="headline24SB" accessibilityRole="header">
            {view.totalText}
          </AppText>
        </View>
        <WeekBarChart chart={view.chart} />
      </View>
      <View style={[styles.band, { backgroundColor: colors.bgRegular }]} />
      <AppText variant="headline20SB" accessibilityRole="header" style={styles.listTitle}>
        최근 기록
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  failed: { paddingTop: space[2], paddingHorizontal: layout.screenPaddingX },
  retry: { marginTop: space[2] },
  list: { paddingBottom: space[6] },
  week: {
    paddingTop: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[6],
    gap: space[4],
  },
  heading: { gap: space[1] },
  band: { height: space[3] },
  listTitle: { paddingTop: space[6], paddingHorizontal: layout.screenPaddingX },
});
