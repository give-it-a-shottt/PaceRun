import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckCircleIcon, PlusIcon } from '@/components/icons';
import { ModeBadge } from '@/components/ModeBadge';
import type { PlanDayView } from '@/services/planData';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

type Props = {
  day: PlanDayView;
  /** 운동이 있으면 바꾸기, 없으면 추가 */
  onPress: () => void;
};

const DAY_COLUMN_WIDTH = 36;
const ADD_CELL_HEIGHT = 48;
const DONE_ICON_SIZE = 24;
const ADD_ICON_SIZE = 16;

/** 주간 계획의 요일 한 줄: 요일 · 날짜 + 운동 카드(없으면 점선 "운동 추가" 칸). 줄 전체가 버튼이다. */
export function PlanDayRow({ day, onPress }: Props) {
  const { workout } = day;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={day.accessibilityLabel}
      accessibilityHint={workout ? '운동 바꾸기' : '운동 추가'}
      onPress={onPress}
      style={styles.row}>
      {({ pressed }) => (
        <>
          <View style={styles.day}>
            <AppText variant={day.isToday ? 'title16SB' : 'body15R'} color={day.isToday ? 'textMain' : 'textSub'}>
              {day.label}
            </AppText>
            <AppText variant="caption12R" color="textSub">
              {day.dateText}
            </AppText>
          </View>
          {workout ? <WorkoutCard workout={workout} pressed={pressed} /> : <AddCell pressed={pressed} />}
        </>
      )}
    </Pressable>
  );
}

function WorkoutCard({ workout, pressed }: { workout: NonNullable<PlanDayView['workout']>; pressed: boolean }) {
  const { colors } = useTheme();
  const today = workout.status === 'today';
  const borderWidth = today ? 2 : 1;

  return (
    <View
      style={[
        styles.card,
        {
          borderWidth,
          // 테두리 굵기가 달라져도 카드 크기와 안쪽 내용 위치가 그대로이게 한다
          paddingHorizontal: space[4] - borderWidth,
          paddingVertical: space[3] - borderWidth,
          borderColor: today ? colors.lineBlack : colors.lineRegular,
          backgroundColor: pressed ? colors.bgRegular : colors.bgDefault,
        },
      ]}>
      <View style={styles.cardText}>
        <ModeBadge mode={workout.mode} />
        <AppText variant="title16SB">{workout.title}</AppText>
      </View>
      {workout.status === 'done' ? (
        <View style={styles.done}>
          <CheckCircleIcon size={DONE_ICON_SIZE} color={colors.statusSuccessBase} weight="fill" />
          <AppText variant="caption11M" color="statusSuccessText">
            완료
          </AppText>
        </View>
      ) : null}
      {today ? <AppText variant="caption12SB">오늘</AppText> : null}
    </View>
  );
}

function AddCell({ pressed }: { pressed: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.addCell, { borderColor: colors.lineStrong }, pressed && { backgroundColor: colors.bgRegular }]}>
      <PlusIcon size={ADD_ICON_SIZE} color={colors.iconSub} />
      <AppText variant="body14R" color="textSub">
        운동 추가
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  day: { width: DAY_COLUMN_WIDTH, alignItems: 'center' },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3], borderRadius: radius.card },
  cardText: { flex: 1, alignItems: 'flex-start', gap: space[1] },
  done: { alignItems: 'center' },
  addCell: {
    flex: 1,
    minHeight: ADD_CELL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4] - 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.card,
  },
});
