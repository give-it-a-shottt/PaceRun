import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TextLink } from '@/components/run/TextLink';
import { Screen } from '@/components/Screen';
import { describeConfig } from '@/domain/runConfig';
import { MODE_LABEL } from '@/domain/runView';
import { isRunConfig } from '@/domain/settings';
import type { RunConfig } from '@/domain/types';
import { startRunSession, type StartResult } from '@/services/runController';
import { showToast } from '@/state/toastStore';
import { layout, space } from '@/theme/tokens';

const COUNT_FROM = 3;
const TICK_MS = 1000;

type StartFailure = Extract<StartResult, { ok: false }>['reason'];

const START_FAILURE_MESSAGE: Record<StartFailure, string> = {
  'already-running': '이미 기록 중인 러닝이 있어요',
  location: '위치를 받을 수 없어 시작하지 못했어요',
  storage: '기록을 저장할 수 없어 시작하지 못했어요',
};

function parseConfig(raw: string | string[] | undefined): RunConfig | null {
  if (typeof raw !== 'string') return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isRunConfig(value) ? value : null;
  } catch {
    return null;
  }
}

/** 카운트다운을 그만두거나 시작에 실패했을 때 홈으로 돌아간다. */
function goHome() {
  // 홈 위에 쌓여서 열렸다면 되돌아간다(홈이 두 겹으로 쌓이지 않게). 보통은 홈을 바꿔 넣고 들어온다.
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/** 3초 카운트다운(3 → 2 → 1). 끝나면 러닝을 시작하고 러닝 중 화면으로 바꾼다. */
export default function CountdownScreen() {
  const params = useLocalSearchParams<{ config?: string; planLabel?: string }>();
  const config = useMemo(() => parseConfig(params.config), [params.config]);
  const planLabel = typeof params.planLabel === 'string' && params.planLabel ? params.planLabel : null;

  const [remaining, setRemaining] = useState(COUNT_FROM);
  /** 러닝을 시작하는 중. 이때부터는 취소할 수 없다. */
  const starting = useRef(false);
  /** 이미 홈으로 돌아가는 중. 두 번 돌아가거나, 나가는 사이 러닝이 시작되지 않게 한다. */
  const left = useRef(false);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    goHome();
  }, []);

  const cancel = useCallback(() => {
    if (!starting.current) leave();
  }, [leave]);

  useEffect(() => {
    if (config) return;
    showToast('러닝 설정을 읽지 못했어요. 다시 시작해 주세요');
    leave();
  }, [config, leave]);

  useEffect(() => {
    if (!config || remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), TICK_MS);
    // 화면이 사라지면(취소) 남은 타이머를 지워 러닝이 시작되지 않게 한다
    return () => clearTimeout(timer);
  }, [config, remaining]);

  useEffect(() => {
    if (!config || remaining > 0 || starting.current || left.current) return;
    starting.current = true;
    startRunSession(config, planLabel)
      .then((result) => {
        if (result.ok) {
          router.replace('/run/active');
          return;
        }
        showToast(START_FAILURE_MESSAGE[result.reason]);
        leave();
      })
      .catch((error: unknown) => {
        console.warn('[countdown] 러닝을 시작하지 못했어요', error);
        showToast('러닝을 시작하지 못했어요. 다시 시도해 주세요');
        leave();
      });
  }, [config, planLabel, remaining, leave]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        // 시작하는 중에는 되돌릴 수 없어 뒤로 가기를 막고, 그 전에는 취소로 본다
        cancel();
        return true;
      });
      return () => subscription.remove();
    }, [cancel]),
  );

  if (!config) return <Screen edges={['top', 'bottom']}>{null}</Screen>;

  const counting = remaining > 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <AppText variant="title16SB" color="textSub">
          {planLabel ?? MODE_LABEL[config.mode]}
        </AppText>
        <AppText variant="display56SB" tabular accessibilityLiveRegion="assertive">
          {counting ? remaining : '시작'}
        </AppText>
        <AppText color="textSub">{describeConfig(config)}</AppText>
      </View>
      <View style={styles.bottom}>{counting ? <TextLink label="취소" onPress={cancel} /> : null}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2], paddingHorizontal: layout.screenPaddingX },
  // 취소 글자가 사라져도 가운데 숫자가 움직이지 않게 높이를 고정한다
  bottom: { height: layout.bottomSafePadding + space[6], alignItems: 'center' },
});
