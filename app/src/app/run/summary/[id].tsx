import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { RunBottomActions } from '@/components/run/RunBottomActions';
import { RunSummaryView } from '@/components/run/RunSummaryView';
import { useAndroidBack } from '@/components/run/useAndroidBack';
import { Screen } from '@/components/Screen';
import { useLoadedValue } from '@/components/useLoadedValue';
import { loadSummaryView } from '@/services/recordsData';
import { useSettingsStore } from '@/state/settingsStore';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

function goHome() {
  router.replace('/home');
}

/** 완료 요약(RUN_01_004). */
export default function RunSummaryScreen() {
  const { scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const weeklyGoal = useSettingsStore((s) => s.settings.weeklyGoal);
  const load = useCallback(() => loadSummaryView(id, Date.now(), weeklyGoal), [id, weeklyGoal]);
  const { state, retry } = useLoadedValue(load, 'summary');

  // 뒤로 가기로 끝난 러닝 화면(카운트다운 등)으로 돌아가지 않고 홈으로 간다
  useAndroidBack(goHome);

  return (
    <Screen>
      <View style={styles.topBar}>
        <AppText variant="title18SB" accessibilityRole="header">
          러닝 완료
        </AppText>
      </View>

      {state.status === 'ready' ? <RunSummaryView view={state.value.view} route={state.value.route} /> : null}
      {/* 폰 안의 DB라 금방 읽힌다. 깜빡이지 않게 읽는 동안은 비워 둔다. */}
      {state.status === 'loading' ? <View style={styles.fill} /> : null}
      {state.status === 'missing' ? (
        <View style={styles.message}>
          <AppText variant="title18SB">기록을 찾지 못했어요</AppText>
          <AppText color="textSub">[확인]을 누르면 홈으로 돌아가요.</AppText>
        </View>
      ) : null}
      {state.status === 'failed' ? (
        <View style={styles.message}>
          <AppText variant="title18SB">기록을 불러오지 못했어요</AppText>
          <AppText color="textSub">잠시 뒤 다시 시도해 주세요.</AppText>
          <Button label="다시 시도" variant="outlineStrong" onPress={retry} style={styles.retry} />
        </View>
      ) : null}

      <RunBottomActions>
        {/* Plum 면은 Dark 바탕에서 대비가 모자라(1.95) 테두리 버튼으로 바꾼다 */}
        <Button label="확인" variant={scheme === 'dark' ? 'outlineStrong' : 'primary'} onPress={goHome} />
      </RunBottomActions>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: layout.screenPaddingX,
    paddingRight: space[2],
  },
  fill: { flex: 1 },
  message: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.screenPaddingX, gap: space[2] },
  retry: { marginTop: space[4] },
});
