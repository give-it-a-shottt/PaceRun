import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChartBarIcon, TimerIcon } from '@/components/icons';
import { QuickRunGpsLinks, QuickRunGpsNotice, QuickRunLocationAlert } from '@/components/run/QuickRunFeedback';
import { useQuickRun } from '@/components/run/useQuickRun';
import { QUICK_RUN_LABEL } from '@/domain/runConfig';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

const ICON_CIRCLE_SIZE = 80;
const ICON_SIZE = 40;

/** REC_01_003 기록 빈 상태: 안내와 [10분만 뛰기]. 홈의 [10분만 뛰기]와 같은 흐름으로 바로 시작한다. */
export function RecordsEmpty() {
  const { colors } = useTheme();
  const quickRun = useQuickRun();

  return (
    <View style={styles.root}>
      <View style={[styles.iconCircle, { backgroundColor: colors.bgRegular }]}>
        <ChartBarIcon size={ICON_SIZE} color={colors.iconSub} />
      </View>
      <AppText variant="headline20SB" accessibilityRole="header" style={styles.center}>
        아직 기록이 없어요
      </AppText>
      <AppText variant="body15R" color="textSub" style={styles.center}>
        10분만 뛰어도 첫 기록이 돼요. 기록이 쌓이면 지난번과 비교해서 보여 드려요.
      </AppText>
      <View style={styles.actions}>
        <QuickRunGpsNotice quickRun={quickRun} />
        <Button
          label={QUICK_RUN_LABEL}
          icon={TimerIcon}
          iconWeight="regular"
          loading={quickRun.busy}
          onPress={quickRun.start}
        />
        <QuickRunGpsLinks quickRun={quickRun} />
      </View>

      <QuickRunLocationAlert quickRun={quickRun} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingHorizontal: space[8],
    paddingVertical: space[6],
  },
  iconCircle: {
    width: ICON_CIRCLE_SIZE,
    height: ICON_CIRCLE_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space[4] },
});
