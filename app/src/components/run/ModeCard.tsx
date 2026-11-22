import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckCircleIcon } from '@/components/icons';
import { MODE_ICON } from '@/components/ModeBadge';
import { MODE_LABEL } from '@/domain/runView';
import type { RunMode } from '@/domain/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

type Props = {
  mode: RunMode;
  description: string;
  selected: boolean;
  onPress: () => void;
};

const ICON_BOX_SIZE = 40;
const ICON_SIZE = 24;
const CHECK_SIZE = 24;
/** 고르지 않은 카드의 빈 동그라미(피그마: 지름 22, 선 1.5) */
const EMPTY_CHECK_SIZE = 22;
const EMPTY_CHECK_BORDER = 1.5;

/** 모드 선택 카드. 선택은 색(배경 · 테두리)만이 아니라 체크로도 보여 준다. */
export function ModeCard({ mode, description, selected, onPress }: Props) {
  const { colors } = useTheme();
  const Icon = MODE_ICON[mode];
  const borderWidth = selected ? 2 : 1;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${MODE_LABEL[mode]}, ${description}`}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderWidth,
          // 테두리 굵기가 달라져도 카드 크기와 안쪽 내용 위치가 그대로이게 한다
          padding: space[4] - borderWidth,
          borderColor: selected ? colors.laneDone : colors.lineRegular,
          backgroundColor: selected ? colors.primarySoft : pressed ? colors.bgLight : colors.bgDefault,
        },
      ]}>
      <View style={[styles.iconBox, { backgroundColor: selected ? colors.bgDefault : colors.bgRegular }]}>
        <Icon size={ICON_SIZE} color={colors.iconMain} />
      </View>
      <View style={styles.text}>
        <AppText variant="title16SB">{MODE_LABEL[mode]}</AppText>
        <AppText variant="body13R" color="textSub">
          {description}
        </AppText>
      </View>
      <View style={styles.check}>
        {selected ? (
          <CheckCircleIcon size={CHECK_SIZE} color={colors.laneDone} weight="fill" />
        ) : (
          <View style={[styles.emptyCheck, { borderColor: colors.iconSub }]} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderRadius: radius.card },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: space[0.5] },
  check: { width: CHECK_SIZE, height: CHECK_SIZE, alignItems: 'center', justifyContent: 'center' },
  emptyCheck: {
    width: EMPTY_CHECK_SIZE,
    height: EMPTY_CHECK_SIZE,
    borderRadius: radius.full,
    borderWidth: EMPTY_CHECK_BORDER,
  },
});
