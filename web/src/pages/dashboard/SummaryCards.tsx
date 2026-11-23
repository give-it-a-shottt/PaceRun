import { CheckIcon, TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react';
import { useId, type ReactNode } from 'react';

import { Card } from '../../components/Card';
import { LoadError, LoadingText, Skeleton } from '../../components/LoadState';
import { Stat, StatSkeleton } from '../../components/Stat';
import type { DashboardView } from '../../domain/dashboard';
import type { GoalWeeksView } from '../../domain/weeks';
import type { CardState } from './cardState';
import styles from './SummaryCards.module.css';

const SMALL_ICON_SIZE = 16;

type SummaryCardProps<T> = {
  /** 값을 읽기 전에도 보이는 카드 이름. 값에서 나오는 이름이면 null(읽는 중에는 자리만 잡는다) */
  title: string | null;
  state: CardState<T>;
  /** 읽는 중에 본문 자리를 잡아 둘 칸들 */
  skeleton: ReactNode;
  children: (value: T) => { title?: string; body: ReactNode };
};

/** 오른쪽 열의 요약 카드 틀: 작은 이름 + 본문. 읽는 중 · 실패를 같은 모양으로 처리한다. */
function SummaryCard<T>({ title, state, skeleton, children }: SummaryCardProps<T>) {
  const titleId = useId();
  const content = state.status === 'ready' ? children(state.value) : null;
  const shownTitle = content?.title ?? title;

  return (
    <Card labelledBy={titleId} busy={state.status === 'loading'}>
      <h2 id={titleId} className={styles.cardTitle}>
        {shownTitle ?? <Skeleton className={styles.skeletonTitle} />}
      </h2>
      {state.status === 'loading' && (
        <>
          {skeleton}
          <LoadingText />
        </>
      )}
      {state.status === 'failed' && <LoadError onRetry={state.retry} />}
      {content?.body}
    </Card>
  );
}

export type GoalWeeksCardValue = { weeks: GoalWeeksView; goalWeeksText: string };

/** 주 목표 달성: 연속 주 수 + 최근 8주 칸 + 이 기간의 달성 주 수 */
export function GoalWeeksCard({ state }: { state: CardState<GoalWeeksCardValue> }) {
  return (
    <SummaryCard
      title="주 목표 달성"
      state={state}
      skeleton={
        <>
          <Skeleton className={styles.skeletonHeadline} />
          <Skeleton className={styles.skeletonWeeks} />
          <Skeleton className={styles.skeletonCaption} />
          <Skeleton className={styles.skeletonCaption} />
        </>
      }
    >
      {({ weeks, goalWeeksText }) => ({
        body: (
          <>
            <p className={styles.headline}>{weeks.headline}</p>
            <ul className={styles.weeks}>
              {weeks.cells.map((cell) => {
                const className = [styles.week, cell.met && styles.weekMet, cell.isCurrent && styles.weekCurrent]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={cell.label} className={styles.weekItem} aria-current={cell.isCurrent ? 'date' : undefined}>
                    <span className={className} role="img" aria-label={cell.title} title={cell.title}>
                      {cell.met && <CheckIcon size={SMALL_ICON_SIZE} aria-hidden />}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className={styles.captions}>
              <p>{weeks.caption}</p>
              <p>{goalWeeksText}</p>
            </div>
          </>
        ),
      })}
    </SummaryCard>
  );
}

/** 이 기간의 합계: 거리 · 횟수 · 시간 */
export function TotalsCard({ state }: { state: CardState<DashboardView> }) {
  return (
    <SummaryCard
      title={null}
      state={state}
      skeleton={<StatSkeleton />}
    >
      {(view) => ({
        title: view.totalsTitle,
        body: (
          <dl className={styles.totals}>
            {view.totals.map((item) => (
              <Stat key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>
        ),
      })}
    </SummaryCard>
  );
}

export type PaceCardValue = {
  view: DashboardView;
  /** 앞 기간(비교 대상)을 아직 읽는 중 */
  comparing: boolean;
};

/** 평균 페이스와 지난 기간 비교 */
export function PaceCard({ state }: { state: CardState<PaceCardValue> }) {
  return (
    <SummaryCard
      title="평균 페이스"
      state={state}
      skeleton={
        <>
          <Skeleton className={styles.skeletonHeadline} />
          <Skeleton className={styles.skeletonNote} />
        </>
      }
    >
      {({ view, comparing }) => ({
        body: (
          <>
            <p className={styles.headline}>{view.paceText}</p>
            {view.paceNote !== '' ? (
              <p className={styles.paceNote}>
                {view.paceTrend === 'faster' && <TrendUpIcon size={SMALL_ICON_SIZE} aria-hidden />}
                {view.paceTrend === 'slower' && <TrendDownIcon size={SMALL_ICON_SIZE} aria-hidden />}
                <span>{view.paceNote}</span>
              </p>
            ) : (
              // 문구가 비면 줄을 그리지 않는다. 앞 기간을 읽는 동안만 자리를 지켜 카드 높이가 튀지 않게 한다.
              comparing && <Skeleton className={styles.skeletonNote} />
            )}
          </>
        ),
      })}
    </SummaryCard>
  );
}
