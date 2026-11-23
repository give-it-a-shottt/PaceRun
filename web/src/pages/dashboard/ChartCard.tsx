import { Suspense, useId } from 'react';

import { createLazyPart } from '../../app/lazyPart';
import { Card } from '../../components/Card';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { EmptyText, LoadError, LoadingText, Skeleton } from '../../components/LoadState';
import type { CardState } from './cardState';
import styles from './ChartCard.module.css';
import type { ChartCardValue } from './useDashboardData';

// 차트 라이브러리(recharts)가 커서 대시보드에 올 때 따로 불러온다(로그인 화면에는 필요 없다)
const { Part: MetricBarChart, retry: reloadChart } = createLazyPart(() => import('./MetricBarChart'));

/** 차트 자리에 들어갈 것: 읽는 중 · 실패 · 빈 기간 · 차트 */
function ChartArea({ state }: { state: CardState<ChartCardValue> }) {
  if (state.status === 'loading') {
    return (
      <>
        <Skeleton className={styles.skeletonFill} />
        <LoadingText />
      </>
    );
  }
  if (state.status === 'failed') return <LoadError onRetry={state.retry} />;

  const { view, period } = state.value;
  if (view.isEmpty) return <EmptyText>이 기간에는 기록이 없어요</EmptyText>;
  return (
    // 차트 조각을 받지 못하거나 그리다 예외가 나도 이 자리만 안내로 바뀐다
    <ErrorBoundary onRetryPart={reloadChart}>
      <Suspense fallback={<Skeleton className={styles.skeletonFill} />}>
        <MetricBarChart view={view} period={period} />
      </Suspense>
    </ErrorBoundary>
  );
}

/** 대시보드의 막대 차트 카드: 차트 제목 + 차트 자리(높이가 고정이라 읽는 중에도 아래 내용이 밀리지 않는다) */
export function ChartCard({ state }: { state: CardState<ChartCardValue> }) {
  const titleId = useId();
  return (
    <Card labelledBy={titleId} busy={state.status === 'loading'}>
      <h2 id={titleId} className={styles.title}>
        {state.status === 'ready' ? state.value.view.chartTitle : <Skeleton className={styles.skeletonTitle} />}
      </h2>
      <div className={styles.area}>
        <ChartArea state={state} />
      </div>
    </Card>
  );
}
