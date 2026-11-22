import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PlusIcon } from '@/components/icons';
import { PlanDayRow } from '@/components/plan/PlanDayRow';
import { PlanEmpty } from '@/components/plan/PlanEmpty';
import { PlanSummary } from '@/components/plan/PlanSummary';
import { usePlanView } from '@/components/plan/usePlanView';
import { WorkoutSheet } from '@/components/plan/WorkoutSheet';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import type { RunConfig } from '@/domain/types';
import { showToast } from '@/state/toastStore';
import { layout, space } from '@/theme/tokens';

/** 운동 시트를 열 요일. config가 있으면 그 요일의 운동을 바꾸는 것이고, 없으면 새로 넣는 것이다. */
type SheetRequest = { weekday: number; config?: RunConfig };

/** 계획 탭: 계획이 있으면 주간 계획(PLN_01_001), 하나도 없으면 빈 상태(PLN_01_004). */
export default function PlanScreen() {
  const { state: plan, reload } = usePlanView();
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const view = plan.view;

  const openTemplates = () => router.navigate('/plan/templates');

  const addWorkout = (weekday: number | null) => {
    if (weekday == null) {
      showToast('모든 요일에 운동이 있어요');
      return;
    }
    setSheet({ weekday });
  };

  return (
    <Screen background="bgLight">
      <TopBar
        variant="title"
        title="계획"
        background="bgLight"
        action={
          view && !view.isEmpty
            ? { icon: PlusIcon, label: '운동 추가', onPress: () => addWorkout(view.nextEmptyWeekday) }
            : undefined
        }
      />

      {/* 폰 안의 DB라 금방 읽힌다. 깜빡이지 않게 읽는 동안은 비워 둔다. */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        {plan.status === 'failed' ? (
          <View style={styles.failed}>
            <Card>
              <AppText variant="title18SB">계획을 불러오지 못했어요</AppText>
              <Button label="다시 시도" variant="outlineStrong" onPress={reload} style={styles.retry} />
            </Card>
          </View>
        ) : null}

        {view?.isEmpty ? (
          <PlanEmpty onPickTemplate={openTemplates} onAddWorkout={() => addWorkout(view.nextEmptyWeekday)} />
        ) : null}

        {view && !view.isEmpty ? (
          <View style={styles.plan}>
            <PlanSummary rangeText={view.rangeText} summaryText={view.summaryText} onChangeTemplate={openTemplates} />
            <View style={styles.days}>
              {view.days.map((day) => (
                <PlanDayRow
                  key={day.weekday}
                  day={day}
                  onPress={() => setSheet({ weekday: day.weekday, config: day.workout?.config })}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <WorkoutSheet
        weekday={sheet?.weekday ?? null}
        initialConfig={sheet?.config}
        onClose={() => setSheet(null)}
        onSaved={reload}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  failed: { paddingTop: space[2], paddingHorizontal: layout.screenPaddingX },
  retry: { marginTop: space[2] },
  plan: {
    paddingTop: space[2],
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space[6],
    gap: space[4],
  },
  days: { gap: space[2] },
});
