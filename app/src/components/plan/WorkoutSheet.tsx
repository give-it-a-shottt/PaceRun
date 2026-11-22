import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ConfigAdjuster } from '@/components/run/ConfigAdjuster';
import { ModeCard } from '@/components/run/ModeCard';
import { TextLink } from '@/components/run/TextLink';
import { PLAN_SAVE_ERROR, workoutSheetTitle } from '@/domain/plan';
import { configForMode, defaultConfigFor, MODE_ORDER, modeDescriptions } from '@/domain/runConfig';
import type { RunConfig, RunMode } from '@/domain/types';
import { removeWorkout, saveWorkout } from '@/services/planData';
import { useSettingsStore } from '@/state/settingsStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, shadow, space } from '@/theme/tokens';

type Props = {
  /** 운동을 넣을 요일(0=월 … 6=일). null이면 닫혀 있다. */
  weekday: number | null;
  /** 그 요일에 이미 있는 운동의 목표값. 있으면 바꾸기 모드(제목이 바뀌고 "이 요일 비우기"가 생긴다). */
  initialConfig?: RunConfig;
  onClose: () => void;
  /** 저장하거나 비운 뒤(시트는 이미 닫혔다). 계획을 다시 읽을 때 쓴다. */
  onSaved: () => void;
};

/** 앱 토스트와 같은 3초 */
const NOTICE_DURATION_MS = 3000;

/** PLN_01_002 운동 추가 시트: 모드 4개 + 목표값 + [저장]. 있는 운동을 누르면 같은 시트가 바꾸기 모드로 열린다. */
export function WorkoutSheet({ weekday, ...rest }: Props) {
  // 열 때마다 처음 값으로 다시 채우도록, 열려 있는 동안에만 내용을 만든다
  return weekday == null ? null : <OpenSheet weekday={weekday} {...rest} />;
}

function OpenSheet({ weekday, initialConfig, onClose, onSaved }: Omit<Props, 'weekday'> & { weekday: number }) {
  const lastRunConfig = useSettingsStore((s) => s.settings.lastRunConfig);
  const defaultCadenceSpm = useSettingsStore((s) => s.settings.defaultCadenceSpm);
  const voiceIntervalKm = useSettingsStore((s) => s.settings.voiceIntervalKm);
  const editing = initialConfig != null;

  /** 시트를 열었을 때 채워 둔 설정 */
  const [opened] = useState<RunConfig>(
    () => initialConfig ?? lastRunConfig ?? defaultConfigFor('interval', defaultCadenceSpm),
  );
  const [config, setConfig] = useState<RunConfig>(opened);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  // 버튼이 로딩으로 바뀌기 전에 한 번 더 눌려도 두 번 저장하지 않게 한다
  const busyRef = useRef(false);
  /** 실패 안내를 띄운 번호(없으면 null). 번호가 바뀔 때마다 3초를 다시 센다. */
  const [notice, setNotice] = useState<number | null>(null);

  useEffect(() => {
    if (notice == null) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const description = modeDescriptions(voiceIntervalKm);

  const selectMode = (mode: RunMode) => {
    if (mode === config.mode) return;
    setConfig(configForMode(mode, { opened, lastRunConfig, defaultCadenceSpm }));
  };

  const run = async (kind: 'save' | 'remove') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setNotice(null);
    try {
      if (kind === 'save') await saveWorkout(weekday, config);
      else await removeWorkout(weekday);
    } catch (error) {
      console.warn('[plan] 계획을 저장하지 못했어요', error);
      busyRef.current = false;
      setBusy(null);
      setNotice((previous) => (previous ?? 0) + 1);
      return;
    }
    onClose();
    onSaved();
  };

  const close = () => {
    // 저장하는 사이에 닫으면 실패했을 때 알릴 곳이 없으므로 끝날 때까지 열어 둔다
    if (!busyRef.current) onClose();
  };

  return (
    <BottomSheet
      visible
      title={workoutSheetTitle(weekday, editing)}
      onClose={close}
      // 앱 토스트는 시트(Modal) 뒤에 가려져서 실패 안내를 시트 위에 직접 그린다
      floating={notice != null ? <SaveErrorNotice /> : null}
      footer={
        <>
          <Button
            label="저장"
            loading={busy === 'save'}
            disabled={busy === 'remove'}
            onPress={() => void run('save')}
          />
          {editing ? (
            <View style={styles.link}>
              <TextLink label="이 요일 비우기" onPress={() => void run('remove')} />
            </View>
          ) : null}
        </>
      }>
      <View accessibilityRole="radiogroup" style={styles.modes}>
        {MODE_ORDER.map((mode) => (
          <ModeCard
            key={mode}
            mode={mode}
            description={description[mode]}
            selected={config.mode === mode}
            onPress={() => selectMode(mode)}
          />
        ))}
      </View>
      <ConfigAdjuster config={config} onChange={setConfig} />
    </BottomSheet>
  );
}

/** 저장 실패 안내(앱 토스트와 같은 모양) */
function SaveErrorNotice() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: colors.bgInverse, boxShadow: shadow.toast }]}>
      <AppText variant="body14M" color="textInverse">
        {PLAN_SAVE_ERROR}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  modes: { gap: space[2] },
  link: { alignItems: 'center' },
  notice: {
    alignSelf: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.button,
  },
});
