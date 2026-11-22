import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlertDialog } from '@/components/AlertDialog';
import { Button } from '@/components/Button';
import { PlayIcon, TimerIcon } from '@/components/icons';
import { GpsNotice } from '@/components/run/GpsNotice';
import { LocationAlert } from '@/components/run/LocationAlert';
import { RunSetupSheet } from '@/components/run/RunSetupSheet';
import { TextLink } from '@/components/run/TextLink';
import { pendingRunMessage, usePendingRunRecovery } from '@/components/run/usePendingRunRecovery';
import { useStartRun } from '@/components/run/useStartRun';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { QUICK_RUN_CONFIG, QUICK_RUN_LABEL } from '@/domain/runConfig';
import { layout, space } from '@/theme/tokens';

/**
 * 임시 홈: [시작] · [10분만 뛰기]와 강제 종료 복구 창만 있다.
 * 주간 칸과 오늘의 러닝 카드는 F-004에서 채운다.
 */
export default function HomeScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const quickRun = useStartRun();
  const recovery = usePendingRunRecovery();
  const cancelQuickRun = quickRun.cancel;

  useFocusEffect(
    useCallback(() => {
      // 다른 탭으로 가면 [10분만 뛰기]의 GPS 확인을 멈춘다
      return () => cancelQuickRun();
    }, [cancelQuickRun]),
  );

  const openSheet = () => {
    // 끝나지 않은 러닝이 있으면 그것부터 정리해야 새 러닝을 시작할 수 있다
    if (recovery.reopenIfPending()) return;
    setSheetOpen(true);
  };

  const startQuickRun = () => {
    if (recovery.reopenIfPending()) return;
    // 시트를 거치지 않으므로 '마지막 설정'은 바꾸지 않는다
    void quickRun.start({ config: QUICK_RUN_CONFIG, planLabel: QUICK_RUN_LABEL, remember: false });
  };

  const searchingGps = quickRun.phase === 'searchingGps';

  return (
    <Screen>
      <TopBar variant="logo" />
      <View style={styles.body}>
        {searchingGps ? <GpsNotice /> : null}
        <View style={styles.actions}>
          <Button label="시작" icon={PlayIcon} disabled={quickRun.busy} onPress={openSheet} />
          <Button
            label={QUICK_RUN_LABEL}
            variant="outlineStrong"
            icon={TimerIcon}
            iconWeight="regular"
            loading={quickRun.busy}
            onPress={startQuickRun}
          />
        </View>
        {searchingGps ? (
          <View style={styles.links}>
            <TextLink label="그냥 시작하기" onPress={quickRun.startAnyway} />
            <TextLink label="취소" onPress={quickRun.cancel} />
          </View>
        ) : null}
      </View>

      <RunSetupSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />

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
  body: { paddingHorizontal: layout.screenPaddingX, paddingVertical: space[6], gap: space[4] },
  actions: { gap: space[2] },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space[6] },
});
