import { Animated, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { InfoIcon, StopIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

import { useHoldProgress } from './useHoldProgress';

type Props = {
  /** 1.5초를 다 누르고 있었을 때 한 번 불린다. */
  onComplete: () => void;
  disabled?: boolean;
};

/** [길게 눌러 종료] — 누르고 있는 동안 버튼 아래쪽 진행 표시가 왼쪽부터 차오른다. */
export function HoldToFinishButton({ onComplete, disabled }: Props) {
  const { colors } = useTheme();
  const { progress, start, cancel } = useHoldProgress(onComplete);

  return (
    <View style={styles.group}>
      <View style={styles.clip}>
        <Button
          label="길게 눌러 종료"
          variant="outlineStrong"
          size="XL"
          icon={StopIcon}
          iconWeight="regular"
          disabled={disabled}
          onPressIn={start}
          onPressOut={cancel}
          accessibilityHint="1.5초 동안 누르고 있으면 러닝이 끝나요"
        />
        <Animated.View
          style={[styles.progress, { backgroundColor: colors.lineBlack, transform: [{ scaleX: progress }] }]}
        />
      </View>
      <View style={styles.hint}>
        <InfoIcon size={16} color={colors.iconSub} />
        <AppText variant="caption12R" color="textSub">
          1.5초 동안 누르고 있으면 끝나요
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch', gap: space[2] },
  // 진행 표시가 버튼의 둥근 모서리 밖으로 나가지 않게 자른다
  clip: { borderRadius: radius.button, overflow: 'hidden' },
  progress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: space[1],
    transformOrigin: 'left',
    pointerEvents: 'none',
  },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[1] },
});
