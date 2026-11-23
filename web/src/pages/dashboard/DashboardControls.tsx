import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router-dom';

import {
  canShiftBack,
  isCurrentPeriod,
  METRIC_LABELS,
  PERIOD_LABELS,
  shiftAnchor,
  type Metric,
} from '../../domain/dashboard';
import type { StatsPeriod } from '../../domain/types';
import { toDashboardSearch, type DashboardQuery } from './dashboardQuery';
import styles from './DashboardControls.module.css';

const STEP_ICON_SIZE = 20;
const PERIODS: StatsPeriod[] = ['month', 'year'];
const METRICS: Metric[] = ['distance', 'count', 'time'];
/** 앞 · 뒤 기간으로 옮기는 버튼의 이름(읽어 주기 · 도움말) */
const STEP_LABELS: Record<StatsPeriod, { previous: string; next: string }> = {
  month: { previous: '이전 달', next: '다음 달' },
  year: { previous: '이전 해', next: '다음 해' },
};

type ControlProps = { query: DashboardQuery; today: string };

/**
 * 앞 · 뒤 기간으로 옮기는 꺾쇠 버튼 두 개.
 * 오늘이 든 기간에서는 "다음"을, 서버가 받는 가장 이른 기간에서는 "이전"을 막는다.
 */
export function PeriodStepper({ query, today }: ControlProps) {
  const navigate = useNavigate();
  const labels = STEP_LABELS[query.period];
  const step = (direction: 1 | -1) => {
    const anchor = shiftAnchor(query.period, query.anchor, direction);
    navigate({ search: toDashboardSearch({ ...query, anchor }, today) });
  };

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.step}
        onClick={() => step(-1)}
        disabled={!canShiftBack(query.period, query.anchor)}
        aria-label={labels.previous}
        title={labels.previous}
      >
        <CaretLeftIcon size={STEP_ICON_SIZE} aria-hidden />
      </button>
      <button
        type="button"
        className={styles.step}
        onClick={() => step(1)}
        disabled={isCurrentPeriod(query.period, query.anchor, today)}
        aria-label={labels.next}
        title={labels.next}
      >
        <CaretRightIcon size={STEP_ICON_SIZE} aria-hidden />
      </button>
    </div>
  );
}

/** 월 / 년 전환(피그마 Tab Line · Color Black · Indicator Full) */
export function PeriodTabs({ query, today }: ControlProps) {
  return (
    <div role="group" className={styles.tabLine} aria-label="기간 단위">
      {PERIODS.map((period) => {
        const active = period === query.period;
        return (
          <Link
            key={period}
            to={{ search: toDashboardSearch({ ...query, period }, today) }}
            className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            aria-current={active ? 'true' : undefined}
          >
            {PERIOD_LABELS[period]}
          </Link>
        );
      })}
    </div>
  );
}

/** 거리 / 횟수 / 시간 전환 */
export function MetricToggle({ query, today }: ControlProps) {
  return (
    <div role="group" className={styles.segmented} aria-label="차트에 그릴 값">
      {METRICS.map((metric) => {
        const active = metric === query.metric;
        return (
          <Link
            key={metric}
            to={{ search: toDashboardSearch({ ...query, metric }, today) }}
            className={active ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
            aria-current={active ? 'true' : undefined}
          >
            {METRIC_LABELS[metric]}
          </Link>
        );
      })}
    </div>
  );
}
