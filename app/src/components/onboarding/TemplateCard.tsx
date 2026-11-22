import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CalendarBlankIcon, CheckCircleIcon } from '@/components/icons';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

type Props = {
  selected: boolean;
  onPress: () => void;
};

const TITLE = '템플릿으로 시작하기';
const DESCRIPTION = '인터벌 입문 주 3회 · 계획을 자동으로 채워요';

// 피그마 Mode Card(6:148)와 같은 값. 러닝 모드가 아니라서 run/ModeCard를 그대로 쓰지 못해 모양만 맞췄다.
const ICON_BOX_SIZE = 40;
const ICON_SIZE = 24;
const CHECK_SIZE = 24;
const EMPTY_CHECK_SIZE = 22;
const EMPTY_CHECK_BORDER = 1.5;

/** "템플릿으로 시작하기" 카드. 누를 때마다 켜지고 꺼지며, 선택은 체크로도 보여 준다. */
export function TemplateCard({ selected, onPress }: Props) {
  const { colors } = useTheme();
  const borderWidth = selected ? 2 : 1;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`${TITLE}, ${DESCRIPTION}`}
      accessibilityState={{ checked: selected }}
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
        <CalendarBlankIcon size={ICON_SIZE} color={colors.iconMain} />
      </View>
      <View style={styles.text}>
        <AppText variant="title16SB">{TITLE}</AppText>
        <AppText variant="body13R" color="textSub">
          {DESCRIPTION}
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
