import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlertDialog } from '@/components/AlertDialog';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TodayCardView } from '@/components/home/TodayCardView';
import { useHomeView } from '@/components/home/useHomeView';
import { WeekSummary } from '@/components/home/WeekSummary';
import { ChartBarIcon, PlayIcon, TimerIcon } from '@/components/icons';
import { GpsNotice } from '@/components/run/GpsNotice';
import { LocationAlert } from '@/components/run/LocationAlert';
import { RunSetupSheet } from '@/components/run/RunSetupSheet';
import { TextLink } from '@/components/run/TextLink';
import { pendingRunMessage, usePendingRunRecovery } from '@/components/run/usePendingRunRecovery';
import { useStartRun } from '@/components/run/useStartRun';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { QUICK_RUN_CONFIG, QUICK_RUN_LABEL } from '@/domain/runConfig';
import type { RunConfig } from '@/domain/types';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

/** 시작 전 설정 시트에 미리 채울 값. 비어 있으면 시트가 마지막 설정(없으면 기본값)으로 열린다. */
type SheetRequest = { initialConfig?: RunConfig; planLabel?: string };

/** 홈(HOM_01_001): 이번 주 칸 · 주 연속 · 오늘의 러닝 카드와 시작 버튼. 오늘 상태 네 가지에 따라 카드와 버튼이 바뀐다. */
export default function HomeScreen() {
  const { colors } = useTheme();
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const { state: home, reload } = useHomeView();
  const quickRun = useStartRun();
  const recovery = usePendingRunRecovery();
  const cancelQuickRun = quickRun.cancel;

  useFocusEffect(
    useCallback(() => {
      // 다른 탭으로 가면 [10분만 뛰기]의 GPS 확인을 멈춘다
      return () => cancelQuickRun();
    }, [cancelQuickRun]),
  );

  const openSheet = (request: SheetRequest) => {
    // 끝나지 않은 러닝이 있으면 그것부터 정리해야 새 러닝을 시작할 수 있다
    if (recovery.reopenIfPending()) return;
    setSheet(request);
  };

  const startQuickRun = () => {
    if (recovery.reopenIfPending()) return;
    // 시트를 거치지 않으므로 '마지막 설정'은 바꾸지 않는다
    void quickRun.start({ config: QUICK_RUN_CONFIG, planLabel: QUICK_RUN_LABEL, remember: false });
  };

  const searchingGps = quickRun.phase === 'searchingGps';
  const today = home.view?.today ?? null;

  const startButton = (label: string, request: SheetRequest) => (
    <Button label={label} icon={PlayIcon} disabled={quickRun.busy} onPress={() => openSheet(request)} />
  );
  const quickRunButton = (label: string) => (
    <Button
      label={label}
      variant="outlineStrong"
      icon={TimerIcon}
      iconWeight="regular"
      loading={quickRun.busy}
      onPress={startQuickRun}
    />
  );

  const actions = () => {
    // 값을 아직 못 읽었거나 읽지 못했어도 러닝은 시작할 수 있어야 한다
    if (!today) {
      return (
        <>
          {startButton('시작', {})}
          {quickRunButton(QUICK_RUN_LABEL)}
        </>
      );
    }
    switch (today.kind) {
      case 'planned':
        return (
          <>
            {startButton('시작', { initialConfig: today.config, planLabel: today.planLabel })}
            {quickRunButton(QUICK_RUN_LABEL)}
          </>
        );
      case 'noPlan':
        return (
          <>
            {startButton(today.startLabel, { initialConfig: today.config })}
            {quickRunButton(QUICK_RUN_LABEL)}
          </>
        );
      case 'restDay':
        return quickRunButton('가볍게 10분 뛰기');
      case 'done':
        return (
          <Button
            label="기록 보기"
            variant="outlineStrong"
            icon={ChartBarIcon}
            iconWeight="regular"
            onPress={() => router.navigate('/records')}
          />
        );
    }
  };

  return (
    <Screen scroll>
      <TopBar variant="logo" />

      {home.view ? (
        <>
          <WeekSummary
            weekLabel={home.view.weekLabel}
            title={home.view.title}
            cells={home.view.cells}
            streakText={home.view.streakText}
            paintKey={today?.kind === 'done' ? today.runId : null}
          />
          <View style={[styles.band, { backgroundColor: colors.bgRegular }]} />
        </>
      ) : null}

      <View style={styles.today}>
        <AppText variant="headline20SB" accessibilityRole="header">
          오늘의 러닝
        </AppText>

        {/* 폰 안의 DB라 금방 읽힌다. 깜빡이지 않게 읽는 동안은 카드 자리를 비워 둔다. */}
        {today ? <TodayCardView card={today} /> : null}
        {home.status === 'failed' ? (
          <Card>
            <AppText variant="title18SB">기록을 불러오지 못했어요</AppText>
            <AppText color="textSub">잠시 뒤 다시 시도해 주세요.</AppText>
            <Button label="다시 시도" variant="outlineStrong" onPress={reload} style={styles.retry} />
          </Card>
        ) : null}

        {searchingGps ? <GpsNotice /> : null}
        <View style={styles.actions}>{actions()}</View>
        {searchingGps ? (
          <View style={styles.links}>
            <TextLink label="그냥 시작하기" onPress={quickRun.startAnyway} />
            <TextLink label="취소" onPress={quickRun.cancel} />
          </View>
        ) : null}
      </View>

      <RunSetupSheet
        visible={sheet != null}
        onClose={() => setSheet(null)}
        initialConfig={sheet?.initialConfig}
        planLabel={sheet?.planLabel}
      />

      {quickRun.locationIssue ? (
        <LocationAlert issue={quickRun.locationIssue} onClose={quickRun.dismissLocationIssue} />
      ) : null}

      <AlertDialog
        visible={recovery.pending != null && recovery.open}
        title="기록 중이던 러닝이 있어요"
        message={recovery.pending ? pendingRunMessage(recovery.pending) : undefined}
        actions={[
          { label: '이어서 뛰기', onPress: recovery.continueRun },
          { label: '여기까지 저장', onPress: recovery.saveRun },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  band: { height: space[3] },
  today: { paddingHorizontal: layout.screenPaddingX, paddingVertical: space[6], gap: space[4] },
  retry: { marginTop: space[2] },
  actions: { gap: space[2] },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space[6] },
});
