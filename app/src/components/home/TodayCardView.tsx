import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { CheckCircleIcon, TimerIcon, TrendUpIcon, type IconProps } from '@/components/icons';
import { ModeBadge } from '@/components/ModeBadge';
import type { TodayCard } from '@/services/homeData';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';

const META_ICON_SIZE = 16;
const DONE_ICON_SIZE = 20;

/** "오늘의 러닝" 카드. 오늘 상태 네 가지(계획 있음 / 계획 없음 / 쉬는 요일 / 오늘 이미 뜀)를 그리기만 한다. */
export function TodayCardView({ card }: { card: TodayCard }) {
  const { colors } = useTheme();

  if (card.kind === 'done') {
    return (
      <Card style={{ backgroundColor: colors.bgLight }}>
        <View style={styles.doneMark}>
          <CheckCircleIcon size={DONE_ICON_SIZE} color={colors.statusSuccessBase} weight="fill" />
          <AppText variant="caption12SB" color="statusSuccessText">
            오늘 러닝 완료
          </AppText>
        </View>
        <AppText variant="title18SB">{card.title}</AppText>
        <AppText color="textSub">{card.stats}</AppText>
        {card.comparison ? (
          <View style={[styles.comparison, { backgroundColor: colors.sub1Soft }]}>
            <TrendUpIcon size={META_ICON_SIZE} color={colors.iconSub} />
            <AppText variant="caption12R" style={styles.fill}>
              {card.comparison}
            </AppText>
          </View>
        ) : null}
      </Card>
    );
  }

  if (card.kind === 'planned') {
    return (
      <Card>
        <ModeBadge mode={card.mode} />
        <AppText variant="title18SB">{card.title}</AppText>
        <AppText color="textSub">{card.description}</AppText>
        {card.estimate || card.lastPaceText ? (
          <View style={styles.metaRow}>
            {card.estimate ? <Meta icon={TimerIcon} text={card.estimate} /> : null}
            {card.lastPaceText ? <Meta icon={TrendUpIcon} text={card.lastPaceText} /> : null}
          </View>
        ) : null}
        <AppText variant="body14R" color="primaryText">
          {card.reason}
        </AppText>
      </Card>
    );
  }

  return (
    <Card>
      <ModeBadge mode={card.mode} />
      <AppText variant="title18SB">{card.title}</AppText>
      <AppText color="textSub">{card.message}</AppText>
    </Card>
  );
}

function Meta({ icon: Icon, text }: { icon: ComponentType<IconProps>; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.meta}>
      <Icon size={META_ICON_SIZE} color={colors.iconSub} />
      <AppText variant="caption12R" color="textSub">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  doneMark: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  comparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.button,
  },
  // 글자를 크게 쓰는 폰에서는 두 값이 한 줄에 안 들어갈 수 있어 줄을 바꾼다
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[3], rowGap: space[1] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  fill: { flex: 1 },
});
