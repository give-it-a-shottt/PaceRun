import { useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Card } from '../../components/Card';
import { Skeleton } from '../../components/LoadState';
import { LoadedRunsTable } from '../../components/RunsTable';
import { toDateText } from '../../domain/dashboard';
import { cardStateOf } from './cardState';
import { ChartCard } from './ChartCard';
import { MetricToggle, PeriodStepper, PeriodTabs } from './DashboardControls';
import { parseDashboardQuery } from './dashboardQuery';
import styles from './DashboardPage.module.css';
import { GoalWeeksCard, PaceCard, TotalsCard } from './SummaryCards';
import { RECENT_RUNS_COUNT, useDashboardData } from './useDashboardData';

/** WEB_01_002 대시보드: 월 · 년 막대 차트, 주 목표 달성, 합계, 평균 페이스, 최근 러닝 */
export function DashboardPage() {
  const [searchParams] = useSearchParams();
  // 화면을 연 시각을 기준으로 삼는다(그리는 도중에 날짜가 바뀌어 조회가 다시 나가지 않게)
  const [now] = useState(() => Date.now());
  const today = toDateText(new Date(now));
  const query = parseDashboardQuery(searchParams, today);
  const data = useDashboardData(query, today, now);
  const recentTitleId = useId();
  // 제목은 통계에서 나온다. 읽기 전에는 자리만 잡아 둔다.
  const view = data.chart.status === 'ready' ? data.chart.value.view : null;

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
        <ChartCard state={data.chart} />
        <div className={styles.side}>
          <GoalWeeksCard state={data.goalWeeks} />
          <TotalsCard state={data.totals} />
          <PaceCard state={data.pace} />
        </div>
      </div>

      <Card labelledBy={recentTitleId} busy={cardStateOf(data.recentRuns).status === 'loading'} flush>
        <h2 id={recentTitleId} className={styles.recentTitle}>
          최근 러닝
        </h2>
        <LoadedRunsTable
          rows={data.recentRuns.data}
          failed={data.recentRuns.failed}
          onRetry={data.recentRuns.retry}
          label="최근 러닝"
          skeletonRows={RECENT_RUNS_COUNT}
        />
      </Card>
    </>
  );
}
