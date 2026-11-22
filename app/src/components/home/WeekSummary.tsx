import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { FlagCheckeredIcon } from '@/components/icons';
import type { HomeView } from '@/services/homeData';
import { useTheme } from '@/theme/ThemeContext';
import { layout, space } from '@/theme/tokens';

import { WeekCells } from './WeekCells';

type Props = Pick<HomeView, 'weekLabel' | 'title' | 'cells' | 'streakText'> & {
  /** 오늘 칸을 칠하게 만든 러닝의 번호(없으면 null) */
  paintKey: string | null;
};

const STREAK_ICON_SIZE = 16;

/** 홈 위쪽: 주차 · "이번 주 2 / 3회" · 주간 칸 7개 · 주 연속 한 줄. */
export function WeekSummary({ weekLabel, title, cells, streakText, paintKey }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <AppText variant="caption12R" color="textSub">
          {weekLabel}
        </AppText>
        <AppText variant="headline20SB" accessibilityRole="header">
          {title}
        </AppText>
      </View>

      <WeekCells cells={cells} paintKey={paintKey} />

      {streakText ? (
        <View style={styles.streak}>
          <FlagCheckeredIcon size={STREAK_ICON_SIZE} color={colors.iconSub} />
          <AppText variant="caption12M" color="textSub" style={styles.streakText}>
            {streakText}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: space[4],
    paddingBottom: space[6],
    paddingHorizontal: layout.screenPaddingX,
    gap: space[3],
  },
  heading: { gap: space[1] },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  streakText: { flex: 1 },
});
