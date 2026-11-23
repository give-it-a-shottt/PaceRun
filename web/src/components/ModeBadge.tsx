import { LightningIcon, MetronomeIcon, PersonSimpleRunIcon, TimerIcon, type Icon } from '@phosphor-icons/react';

import type { RunMode } from '../domain/types';
import styles from './ModeBadge.module.css';

const ICON_SIZE = 16;

/** 모드를 나타내는 아이콘(앱의 ModeBadge와 같은 짝) */
const MODE_ICON: Record<RunMode, Icon> = {
  free: PersonSimpleRunIcon,
  interval: TimerIcon,
  cadence: MetronomeIcon,
  pacemaker: LightningIcon,
};

/** 운동 모드 배지. 색만으로 구분하지 않도록 아이콘과 이름을 함께 보여 준다. */
export function ModeBadge({ mode, label }: { mode: RunMode; label: string }) {
  const ModeIcon = MODE_ICON[mode];
  return (
    <span className={`${styles.badge} ${styles[mode]}`}>
      <ModeIcon size={ICON_SIZE} aria-hidden />
      {label}
    </span>
  );
}
