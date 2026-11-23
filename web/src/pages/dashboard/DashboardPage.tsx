import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchRunsPage, fetchRunsSince, fetchStats } from '../../api/runs';
import { hasFailed } from '../../app/queryClient';
import { Card } from '../../components/Card';
import { EmptyText, LoadError, LoadingText, Skeleton } from '../../components/LoadState';
import { RunsTable, RunsTableSkeleton } from '../../components/RunsTable';
import { describeDashboard, shiftAnchor, toDateText, type DashboardView } from '../../domain/dashboard';
import { describeRunRow } from '../../domain/runView';
import { describeGoalWeeks, streakWindowStart } from '../../domain/weeks';
import { MetricToggle, PeriodStepper, PeriodTabs } from './DashboardControls';
import { parseDashboardQuery } from './dashboardQuery';
import styles from './DashboardPage.module.css';
import { GoalWeeksCard, PaceCard, TotalsCard, type CardState, type GoalWeeksCardValue } from './SummaryCards';

// 차트 라이브러리(recharts)가 커서 대시보드에 올 때 따로 불러온다(로그인 화면에는 필요 없다)
const MetricBarChart = lazy(() => import('./MetricBarChart'));

/** "최근 러닝" 표에 보여 주는 줄 수 */
const RECENT_RUNS_COUNT = 5;

/** WEB_01_002 대시보드: 월 · 년 막대 차트, 주 목표 달성, 합계, 평균 페이스, 최근 러닝 */
export function DashboardPage() {
  const [searchParams] = useSearchParams();
  // 화면을 연 시각을 기준으로 삼는다(그리는 도중에 날짜가 바뀌어 조회가 다시 나가지 않게)
  const [now] = useState(() => Date.now());
  const today = toDateText(new Date(now));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = parseDashboardQuery(searchParams, today);
  const { period, anchor, metric } = query;
  const chartTitleId = useId();
  const recentTitleId = useId();

  const statsQuery = useQuery({
    queryKey: ['stats', period, anchor, tz],
    queryFn: () => fetchStats(period, anchor, tz),
  });
  // 바로 앞 기간: 평균 페이스 비교에만 쓴다. 실패해도 화면은 그대로 두고 비교 문구만 비운다.
  const previousAnchor = shiftAnchor(period, anchor, -1);
  const previousQuery = useQuery({
    queryKey: ['stats', period, previousAnchor, tz],
    queryFn: () => fetchStats(period, previousAnchor, tz),
  });
  const weekWindowStart = streakWindowStart(now);
  const weekRunsQuery = useQuery({
    queryKey: ['runs', 'since', weekWindowStart],
    queryFn: () => fetchRunsSince(weekWindowStart),
  });
  const recentQuery = useQuery({
    queryKey: ['runs', 'recent', RECENT_RUNS_COUNT],
    queryFn: () => fetchRunsPage(null, RECENT_RUNS_COUNT),
  });

  const stats = statsQuery.data;
  const view = stats ? describeDashboard({ stats, previous: previousQuery.data ?? null, metric, today }) : null;
  const statsFailed = hasFailed(statsQuery);
  const retryStats = () => void statsQuery.refetch();

  const viewState: CardState<DashboardView> = view
    ? { status: 'ready', value: view }
    : statsFailed
      ? { status: 'failed', retry: retryStats }
      : { status: 'loading' };

  // 주 목표 카드는 통계(주 목표 횟수 · 이 기간의 달성 주 수)와 최근 러닝 목록이 둘 다 있어야 그린다
  let goalState: CardState<GoalWeeksCardValue> = { status: 'loading' };
  if (stats && view && weekRunsQuery.data) {
    goalState = {
      status: 'ready',
      value: {
        weeks: describeGoalWeeks(weekRunsQuery.data, stats.weekly_goal, now),
        goalWeeksText: view.goalWeeksText,
      },
    };
  } else if (statsFailed || hasFailed(weekRunsQuery)) {
    goalState = {
      status: 'failed',
      retry: () => {
        if (statsFailed) retryStats();
        if (hasFailed(weekRunsQuery)) void weekRunsQuery.refetch();
      },
    };
  }

  const recentRows = recentQuery.data?.items.map(describeRunRow);

  return (
    <>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>{view?.eyebrow}</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{view ? view.title : <Skeleton className={styles.skeletonTitle} />}</h1>
            <PeriodStepper query={query} today={today} />
          </div>
        </div>
        <PeriodTabs query={query} today={today} />
        <MetricToggle query={query} today={today} />
      </header>

      <div className={styles.overview}>
        <Card labelledBy={chartTitleId} busy={viewState.status === 'loading'}>
          <h2 id={chartTitleId} className={styles.cardTitle}>
            {view ? view.chartTitle : <Skeleton className={styles.skeletonCardTitle} />}
          </h2>
          <div className={styles.chartArea}>
            {viewState.status === 'loading' && (
              <>
                <Skeleton className={styles.skeletonFill} />
                <LoadingText />
              </>
            )}
            {viewState.status === 'failed' && <LoadError onRetry={viewState.retry} />}
            {view && stats && view.isEmpty && <EmptyText>이 기간에는 기록이 없어요</EmptyText>}
            {view && stats && !view.isEmpty && (
              <Suspense fallback={<Skeleton className={styles.skeletonFill} />}>
                <MetricBarChart view={view} period={stats.period} />
              </Suspense>
            )}
          </div>
        </Card>

        <div className={styles.side}>
          <GoalWeeksCard state={goalState} />
          <TotalsCard state={viewState} />
          <PaceCard
            state={
              viewState.status === 'ready'
                ? { status: 'ready', value: { view: viewState.value, comparing: previousQuery.isPending } }
                : viewState
            }
          />
        </div>
      </div>

      <Card labelledBy={recentTitleId} busy={recentQuery.isPending} flush>
        <h2 id={recentTitleId} className={`${styles.cardTitle} ${styles.recentTitle}`}>
          최근 러닝
        </h2>
        {recentRows ? (
          recentRows.length > 0 ? (
            <RunsTable rows={recentRows} label="최근 러닝" />
          ) : (
            <EmptyText>아직 러닝 기록이 없어요</EmptyText>
          )
        ) : hasFailed(recentQuery) ? (
          <LoadError onRetry={() => void recentQuery.refetch()} />
        ) : (
          <>
            <RunsTableSkeleton rowCount={RECENT_RUNS_COUNT} />
            <LoadingText />
          </>
        )}
      </Card>
    </>
  );
}
