import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { PlayIcon } from '@/components/icons';
import { defaultConfigFor } from '@/domain/runConfig';
import type { RunConfig, RunMode } from '@/domain/types';
import { isBatteryOptimized, openBatterySettings } from '@/services/permissions';
import { useSettingsStore } from '@/state/settingsStore';
import { space } from '@/theme/tokens';

import { BatteryBanner } from './BatteryBanner';
import { ConfigAdjuster } from './ConfigAdjuster';
import { GpsNotice } from './GpsNotice';
import { LocationAlert } from './LocationAlert';
import { ModeCard } from './ModeCard';
import { TextLink } from './TextLink';
import { useStartRun } from './useStartRun';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 미리 채울 설정(홈의 "오늘 계획"). 없으면 마지막 설정, 그것도 없으면 자유 러닝 기본값으로 연다. */
  initialConfig?: RunConfig;
  /** initialConfig에 붙는 계획 이름. 설정을 바꾸지 않고 시작했을 때만 러닝에 붙는다. */
  planLabel?: string | null;
};

/** 카드 순서는 피그마(RUN_01_001)를 따른다 */
const MODE_ORDER: readonly RunMode[] = ['interval', 'cadence', 'pacemaker', 'free'];

/** RUN_01_001 시작 전 설정 시트: 모드 4개 + 목표값 + (배터리 경고) + [시작] */
export function RunSetupSheet({ visible, ...rest }: Props) {
  // 열 때마다 처음 값으로 다시 채우고 닫으면 확인을 멈추도록, 열려 있는 동안에만 내용을 만든다
  return visible ? <OpenSheet {...rest} /> : null;
}

function OpenSheet({ onClose, initialConfig, planLabel = null }: Omit<Props, 'visible'>) {
  const lastRunConfig = useSettingsStore((s) => s.settings.lastRunConfig);
  const defaultCadenceSpm = useSettingsStore((s) => s.settings.defaultCadenceSpm);
  const voiceIntervalKm = useSettingsStore((s) => s.settings.voiceIntervalKm);

  /** 시트를 열었을 때 채워 둔 설정 */
  const [opened] = useState<RunConfig>(() => initialConfig ?? lastRunConfig ?? defaultConfigFor('free', defaultCadenceSpm));
  const [config, setConfig] = useState<RunConfig>(opened);
  const batteryOptimized = useBatteryOptimized();
  const { phase, busy, start, startAnyway, cancel, locationIssue, dismissLocationIssue } = useStartRun();
  const searchingGps = phase === 'searchingGps';

  const description: Record<RunMode, string> = {
    interval: '달리기·걷기 구간을 음성으로 안내',
    cadence: '분당 걸음 수에 맞춰 박자 소리',
    pacemaker: '목표 페이스에서 벗어나면 알려 줌',
    free: `${voiceIntervalKm}km마다 거리·페이스만 안내`,
  };

  const change = (next: RunConfig) => {
    // 확인하는 사이 설정을 바꾸면 예전 설정으로 시작되지 않게 확인을 그만둔다
    if (busy) cancel();
    setConfig(next);
  };

  const selectMode = (mode: RunMode) => {
    if (mode === config.mode) return;
    // 열 때 채운 값 → 마지막 설정 → 기본값 순으로, 그 모드에서 쓰던 값을 되살린다
    if (opened.mode === mode) change(opened);
    else if (lastRunConfig?.mode === mode) change(lastRunConfig);
    else change(defaultConfigFor(mode, defaultCadenceSpm));
  };

  const handleStart = () => {
    // 계획 이름은 계획대로 뛸 때만 붙인다(값을 바꿨으면 그 계획이 아니다)
    const keepsPlan = JSON.stringify(config) === JSON.stringify(opened);
    void start({ config, planLabel: keepsPlan ? planLabel : null, remember: true, onProceed: onClose });
  };

  return (
    <BottomSheet
      visible
      title="어떻게 뛸까요?"
      onClose={onClose}
      floating={searchingGps ? <GpsNotice /> : null}
      footer={
        <>
          <Button label={searchingGps ? 'GPS 찾는 중…' : '시작'} icon={PlayIcon} loading={busy} onPress={handleStart} />
          {searchingGps ? (
            <View style={styles.link}>
              <TextLink label="그냥 시작하기" onPress={startAnyway} />
            </View>
          ) : null}
          {/* 확인 창은 시트(Modal) 안에 두어야 시트 위에 뜬다 */}
          {locationIssue ? <LocationAlert issue={locationIssue} onClose={dismissLocationIssue} /> : null}
        </>
      }>
      {batteryOptimized ? <BatteryBanner onOpenSettings={() => void openBatterySettings()} /> : null}
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
      <ConfigAdjuster config={config} onChange={change} />
    </BottomSheet>
  );
}

/** 배터리 최적화가 켜져 있는지. 시트를 열 때와, 설정 화면에 다녀와 앱으로 돌아올 때마다 다시 확인한다. */
function useBatteryOptimized(): boolean {
  const [optimized, setOptimized] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => {
      void isBatteryOptimized().then((value) => {
        if (alive) setOptimized(value);
      });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return optimized;
}

const styles = StyleSheet.create({
  modes: { gap: space[2] },
  link: { alignItems: 'center' },
});
