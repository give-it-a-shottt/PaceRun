import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckCircleIcon } from '@/components/icons';
import { templateDays } from '@/domain/plan';
import type { RunMode } from '@/domain/types';
import type { PlanTemplate } from '@/services/planData';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space, type ColorName } from '@/theme/tokens';

type Props = {
  template: PlanTemplate;
  selected: boolean;
  onPress: () => void;
};

/** 요일 칸의 모드 색. 모드 배지(ModeBadge)와 같은 토큰을 쓴다. */
const MODE_COLOR: Record<RunMode, { text: ColorName; soft: ColorName }> = {
  free: { text: 'badgeBlackText', soft: 'badgeBlackSoft' },
  interval: { text: 'badgePlumText', soft: 'badgePlumSoft' },
  cadence: { text: 'badgeBlueText', soft: 'badgeBlueSoft' },
  pacemaker: { text: 'badgeGreenText', soft: 'badgeGreenSoft' },
};

const DAY_CELL_HEIGHT = 28;
// 피그마 Mode Card(6:148)의 체크와 같은 값
const CHECK_SIZE = 24;
const EMPTY_CHECK_SIZE = 22;
const EMPTY_CHECK_BORDER = 1.5;

/** 템플릿 카드: 이름 · 요약과 요일 배치 미리보기 7칸. 선택은 색(배경 · 테두리)만이 아니라 체크로도 보여 준다. */
export function PlanTemplateCard({ template, selected, onPress }: Props) {
  const { colors } = useTheme();
  const days = templateDays(template);
  const borderWidth = selected ? 2 : 1;
  /** 칸의 색은 읽어 주지 않으므로 운동이 있는 요일을 말로 붙인다: "월 · 목 · 토" */
  const plannedDays = days
    .filter((day) => day.mode != null)
    .map((day) => day.label)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${template.title}, ${template.summary}, 요일 ${plannedDays}`}
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
      <View style={styles.head}>
        <View style={styles.text}>
          <AppText variant="title16SB">{template.title}</AppText>
          <AppText variant="caption12R" color="textSub">
            {template.summary}
          </AppText>
        </View>
        <View style={styles.check}>
          {selected ? (
            <CheckCircleIcon size={CHECK_SIZE} color={colors.laneDone} weight="fill" />
          ) : (
            <View style={[styles.emptyCheck, { borderColor: colors.iconSub }]} />
          )}
        </View>
      </View>
      <View style={styles.days}>
        {days.map((day) => {
          const color = day.mode ? MODE_COLOR[day.mode] : null;
          return (
            <View
              key={day.label}
              style={[styles.dayCell, { backgroundColor: color ? colors[color.soft] : colors.bgRegular }]}>
              <AppText variant={color ? 'caption12SB' : 'caption12R'} color={color ? color.text : 'textSub'}>
                {day.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[3], borderRadius: radius.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  text: { flex: 1, gap: space[0.5] },
  check: { width: CHECK_SIZE, height: CHECK_SIZE, alignItems: 'center', justifyContent: 'center' },
  emptyCheck: {
    width: EMPTY_CHECK_SIZE,
    height: EMPTY_CHECK_SIZE,
    borderRadius: radius.full,
    borderWidth: EMPTY_CHECK_BORDER,
  },
  days: { flexDirection: 'row', gap: space[1] },
  dayCell: {
    flex: 1,
    minHeight: DAY_CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.tag,
  },
});
