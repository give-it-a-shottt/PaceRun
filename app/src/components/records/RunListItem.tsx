import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ModeBadge } from '@/components/ModeBadge';
import type { RunListItemView } from '@/services/recordsData';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

/** 피그마 Run Record Row(6:117)의 높이 */
const ROW_MIN_HEIGHT = 72;

type Props = {
  item: RunListItemView;
  onPress: () => void;
};

/** 기록 목록의 러닝 한 줄: 모드 배지 + 제목 + 날짜 / 거리 + 페이스. 누르면 러닝 상세로 간다. */
export function RunListItem({ item, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
      accessibilityHint="러닝 상세를 열어요"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.lineLight }, pressed && styles.pressed]}>
      <View style={styles.main}>
        <ModeBadge mode={item.mode} />
        <AppText variant="title16SB" numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText variant="caption12R" color="textSub" numberOfLines={1}>
          {item.dateText}
        </AppText>
      </View>
      <View style={styles.numbers}>
        <AppText variant="title16SB">{item.distanceText}</AppText>
        {item.paceText ? (
          <AppText variant="caption12R" color="textSub">
            {item.paceText}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: ROW_MIN_HEIGHT + space[2] * 2,
    marginHorizontal: layout.screenPaddingX,
    paddingVertical: space[2],
    borderBottomWidth: 1,
  },
  main: { flex: 1, alignItems: 'flex-start', gap: space[1] },
  numbers: { alignItems: 'flex-end', gap: space[0.5] },
  pressed: { opacity: 0.6 },
});
