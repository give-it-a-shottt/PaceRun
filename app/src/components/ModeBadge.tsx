import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RunMode } from '@/domain/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space, type ColorName } from '@/theme/tokens';

import { AppText } from './AppText';
import { LightningIcon, MetronomeIcon, PersonSimpleRunIcon, TimerIcon, type IconProps } from './icons';

/** 모드를 나타내는 아이콘. 배지와 모드 선택 카드가 같은 아이콘을 쓴다. */
export const MODE_ICON: Record<RunMode, ComponentType<IconProps>> = {
  free: PersonSimpleRunIcon,
  interval: TimerIcon,
  cadence: MetronomeIcon,
  pacemaker: LightningIcon,
};

/** 배지는 자리가 좁아 피그마의 짧은 이름을 쓴다(화면 제목 등에 쓰는 이름은 domain/runView의 MODE_LABEL). */
const BADGE: Record<RunMode, { label: string; text: ColorName; soft: ColorName }> = {
  free: { label: '자유', text: 'badgeBlackText', soft: 'badgeBlackSoft' },
  interval: { label: '인터벌', text: 'badgePlumText', soft: 'badgePlumSoft' },
  cadence: { label: '발걸음 박자', text: 'badgeBlueText', soft: 'badgeBlueSoft' },
  pacemaker: { label: '페이스', text: 'badgeGreenText', soft: 'badgeGreenSoft' },
};

const ICON_SIZE = 16;

/** 운동 모드 배지. 색만으로 구분하지 않도록 아이콘과 이름을 함께 보여 준다. */
export function ModeBadge({ mode }: { mode: RunMode }) {
  const { colors } = useTheme();
  const { label, text, soft } = BADGE[mode];
  const Icon = MODE_ICON[mode];

  return (
    <View style={[styles.badge, { backgroundColor: colors[soft] }]}>
      <Icon size={ICON_SIZE} color={colors[text]} />
      <AppText variant="caption12M" color={text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1],
    paddingLeft: space[1.5],
    paddingRight: space[2],
    paddingVertical: space[1],
    borderRadius: radius.tag,
  },
});
