import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AlertDialog } from '@/components/AlertDialog';
import { Button } from '@/components/Button';
import { PlayIcon, TimerIcon } from '@/components/icons';
import { GpsNotice } from '@/components/run/GpsNotice';
import { LocationAlert } from '@/components/run/LocationAlert';
import { RunSetupSheet } from '@/components/run/RunSetupSheet';
import { TextLink } from '@/components/run/TextLink';
import { useStartRun } from '@/components/run/useStartRun';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { formatDistanceKm, formatDuration } from '@/domain/format';
import { QUICK_RUN_CONFIG, QUICK_RUN_LABEL } from '@/domain/runConfig';
import { checkPendingRun, continuePendingRun, savePendingRun, type PendingRun } from '@/services/runController';
import { showToast } from '@/state/toastStore';
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

function pendingRunMessage(run: PendingRun): string {
  return `${formatDuration(run.elapsedMs)} 동안 ${formatDistanceKm(run.distanceM)} km를 뛴 러닝이 끝나지 않은 채 남아 있어요.`;
}

/**
 * RUN_02_003 강제 종료 복구. 홈이 보일 때마다(탭으로 돌아오거나 앱으로 돌아올 때) 끝나지 않은 러닝을 찾는다.
 * 아직 기록 중이면 러닝 화면으로 바로 보내고, 멈춰 있으면 "이어서 / 여기까지 저장"을 묻는다.
 */
function usePendingRunRecovery() {
  /** 끝나지 않은 채 멈춰 있는 러닝. 이어서 뛰거나 저장할 때까지 남는다. */
  const [pending, setPending] = useState<PendingRun | null>(null);
  const [open, setOpen] = useState(false);
  const focused = useRef(false);
  /** 이어서 · 저장을 처리하는 중. 버튼을 다시 눌러도 받지 않는다. */
  const working = useRef(false);
  /** 확인이 겹치면 러닝 화면으로 두 번 보낼 수 있어 한 번에 하나만 돌린다. */
  const checking = useRef(false);

  const check = useCallback(async (openWhenFound: boolean) => {
    if (working.current || checking.current) return;
    checking.current = true;
    try {
      const found = await checkPendingRun();
      if (!focused.current || working.current) return;
      if (found?.stillRunning) {
        router.replace('/run/active');
        return;
      }
      setPending(found);
      setOpen(openWhenFound && found != null);
    } catch (error) {
      // 확인하지 못해도 홈은 그대로 쓸 수 있어야 한다
      console.warn('[home] 끝나지 않은 러닝을 확인하지 못했어요', error);
    } finally {
      checking.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void check(true);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void check(true);
      });
      return () => {
        focused.current = false;
        subscription.remove();
      };
    }, [check]),
  );

  /** 실패하면 창을 닫고 토스트로 알린다(토스트는 창 뒤에 가려진다). 남은 러닝은 다시 확인해 둔다. */
  const fail = useCallback(
    (message: string) => {
      working.current = false;
      setOpen(false);
      showToast(message);
      void check(false);
    },
    [check],
  );

  const continueRun = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    try {
      if (await continuePendingRun()) {
        working.current = false;
        setPending(null);
        setOpen(false);
        router.replace('/run/active');
        return;
      }
    } catch (error) {
      console.warn('[home] 러닝을 이어서 기록하지 못했어요', error);
    }
    fail('이어서 기록하지 못했어요. 위치 권한을 확인해 주세요');
  }, [fail]);

  const saveRun = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    try {
      const summary = await savePendingRun();
      if (summary) {
        working.current = false;
        setPending(null);
        setOpen(false);
        router.replace({ pathname: '/run/summary/[id]', params: { id: summary.runId } });
        return;
      }
    } catch (error) {
      console.warn('[home] 멈춰 있던 러닝을 저장하지 못했어요', error);
    }
    fail('러닝을 저장하지 못했어요. 다시 시도해 주세요');
  }, [fail]);

  /** 끝나지 않은 러닝이 남아 있으면 복구 창을 다시 띄우고 true를 돌려준다. */
  const reopenIfPending = useCallback(() => {
    if (!pending) return false;
    setOpen(true);
    return true;
  }, [pending]);

  return { pending, open, continueRun, saveRun, reopenIfPending };
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.screenPaddingX, paddingVertical: space[6], gap: space[4] },
  actions: { gap: space[2] },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space[6] },
});
