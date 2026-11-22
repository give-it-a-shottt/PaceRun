import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';

import { AlertDialog } from '@/components/AlertDialog';
import { Button } from '@/components/Button';
import { PauseIcon, PlayIcon } from '@/components/icons';
import { HoldToFinishButton } from '@/components/run/HoldToFinishButton';
import { RunBottomActions } from '@/components/run/RunBottomActions';
import { RunDashboard } from '@/components/run/RunDashboard';
import { useAndroidBack } from '@/components/run/useAndroidBack';
import { Screen } from '@/components/Screen';
import { msUntilCounted } from '@/domain/runEngine';
import { describeRun } from '@/domain/runView';
import { finishRunSession, pauseRunSession, resumeRunSession } from '@/services/runController';
import { useRunStore } from '@/state/runStore';
import { showToast } from '@/state/toastStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

const MINUTE_MS = 60_000;

/** 러닝 중 · 일시정지 · GPS 끊김(RUN_01_002 · RUN_01_003 · RUN_02_006)을 한 화면의 상태로 그린다. */
export default function ActiveRunScreen() {
  const { scheme } = useTheme();
  const run = useRunStore((s) => s.run);
  const now = useRunStore((s) => s.now);
  const saveFailing = useRunStore((s) => s.saveFailing);

  const [finishing, setFinishing] = useState(false);
  // 같은 종료를 두 번 부르지 않게 막는다(알럿 버튼을 연달아 누르는 경우)
  const finishStarted = useRef(false);
  const [earlyFinish, setEarlyFinish] = useState({ visible: false, minutesLeft: 0 });

  // 뛰는 중에 뒤로 가기로 화면을 벗어나면 기록이 도는 채로 조작할 곳이 없어진다
  useAndroidBack();

  if (!run) {
    // 종료 저장이 끝나면 run이 먼저 비고 그다음에 완료 요약으로 넘어간다. 그 사이에 홈으로 보내지 않는다.
    return finishing ? <Screen>{null}</Screen> : <Redirect href="/home" />;
  }

  const view = describeRun(run, now);

  const finish = async () => {
    if (finishStarted.current) return;
    finishStarted.current = true;
    setFinishing(true);
    const summary = await finishRunSession().catch(() => null);
    if (summary) {
      router.replace({ pathname: '/run/summary/[id]', params: { id: summary.runId } });
      return;
    }
    finishStarted.current = false;
    setFinishing(false);
    showToast('기록을 저장하지 못했어요. 다시 시도해 주세요.');
  };

  const handleHoldComplete = () => {
    const leftMs = msUntilCounted(run, now);
    if (leftMs > 0) {
      setEarlyFinish({ visible: true, minutesLeft: Math.ceil(leftMs / MINUTE_MS) });
      return;
    }
    void finish();
  };

  const closeEarlyFinish = () => setEarlyFinish((prev) => ({ ...prev, visible: false }));

  return (
    <Screen>
      <RunDashboard view={view} saveFailing={saveFailing} />

      <RunBottomActions>
        {view.paused ? (
          <>
            <Button
              label="재개"
              variant="strong"
              size="XL"
              icon={PlayIcon}
              disabled={finishing}
              onPress={() => void resumeRunSession()}
            />
            <HoldToFinishButton onComplete={handleHoldComplete} disabled={finishing} />
          </>
        ) : (
          <Button
            label="일시정지"
            variant={scheme === 'dark' ? 'outlineStrong' : 'strong'}
            size="XL"
            icon={PauseIcon}
            onPress={() => void pauseRunSession()}
          />
        )}
      </RunBottomActions>

      {/* 확인 창은 피그마에 Light만 있고 Dark 색(bg/elevated)이 정해지지 않아 Light로 그린다 */}
      <ThemeProvider scheme="light">
        <AlertDialog
          visible={earlyFinish.visible}
          title={`${earlyFinish.minutesLeft}분만 더 뛰면 1회 인정이에요`}
          message="지금 끝내도 기록은 저장되지만, 이번 주 횟수에는 들어가지 않아요."
          actions={[
            { label: '더 뛰기', onPress: closeEarlyFinish },
            {
              label: '그냥 종료',
              onPress: () => {
                closeEarlyFinish();
                void finish();
              },
            },
          ]}
          onRequestClose={closeEarlyFinish}
        />
      </ThemeProvider>
    </Screen>
  );
}
