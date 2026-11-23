import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchRunsPage, fetchRunsSince, fetchStats } from '../../api/runs';
import { canShiftBack, describeDashboard, shiftAnchor, type DashboardView } from '../../domain/dashboard';
import { describeRunRow, type RunRowView } from '../../domain/runView';
import type { StatsPeriod } from '../../domain/types';
import { describeGoalWeeks, streakWindowStart } from '../../domain/weeks';
import { cardStateOf, combineCardState, loadedOf, mapLoaded, type CardState, type Loaded } from './cardState';
import type { DashboardQuery } from './dashboardQuery';
import type { GoalWeeksCardValue, PaceCardValue } from './SummaryCards';

/** "최근 러닝" 표에 보여 주는 줄 수 */
export const RECENT_RUNS_COUNT = 5;

/** 차트 카드가 그릴 값. period는 서버가 답한 기간 단위(막대 굵기를 고르는 데 쓴다) */
export type ChartCardValue = { view: DashboardView; period: StatsPeriod };

export type DashboardData = {
  chart: CardState<ChartCardValue>;
  goalWeeks: CardState<GoalWeeksCardValue>;
  totals: CardState<DashboardView>;
  pace: CardState<PaceCardValue>;
  recentRuns: Loaded<RunRowView[]>;
};

/**
 * 대시보드가 읽는 조회 4개(이 기간의 통계 · 바로 앞 기간의 통계 · 연속 주를 세는 데 쓰는 최근 러닝(기간은 domain/weeks의 STREAK_LOOKBACK_WEEKS) · 최근 러닝 5개)를 부르고
 * 카드마다 그릴 상태로 정리한다. now는 화면을 연 시각, today는 그 날짜("YYYY-MM-DD").
 */
export function useDashboardData({ period, anchor, metric }: DashboardQuery, today: string, now: number): DashboardData {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const statsQuery = useQuery({
    queryKey: ['stats', period, anchor, tz],
    queryFn: () => fetchStats(period, anchor, tz),
  });
  // 바로 앞 기간: 평균 페이스 비교에만 쓴다. 실패해도 화면은 그대로 두고 비교 문구만 비운다.
  // 서버가 받는 가장 이른 날짜보다 앞이면 묻지 않는다(422가 올 뿐이다).
  const hasPrevious = canShiftBack(period, anchor);
  const previousAnchor = shiftAnchor(period, anchor, -1);
  const previousQuery = useQuery({
    queryKey: ['stats', period, previousAnchor, tz],
    queryFn: hasPrevious ? () => fetchStats(period, previousAnchor, tz) : skipToken,
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

  const previous = previousQuery.data ?? null;
  const comparing = hasPrevious && previousQuery.isPending;
  // 통계 하나에서 차트 · 합계 · 평균 페이스가 모두 나온다. 통계를 못 읽으면 세 카드가 같이 실패한다.
  const overview = mapLoaded(loadedOf(statsQuery), (stats) => ({
    stats,
    view: describeDashboard({ stats, previous, metric, today }),
  }));

  return {
    chart: cardStateOf(mapLoaded(overview, ({ stats, view }) => ({ view, period: stats.period }))),
    // 주 목표 카드는 통계(주 목표 횟수 · 이 기간의 달성 주 수)와 최근 러닝 목록이 둘 다 있어야 그린다
    goalWeeks: combineCardState(overview, loadedOf(weekRunsQuery), ({ stats, view }, runs) => ({
      weeks: describeGoalWeeks(runs, stats.weekly_goal, now),
      goalWeeksText: view.goalWeeksText,
    })),
    totals: cardStateOf(mapLoaded(overview, ({ view }) => view)),
    pace: cardStateOf(mapLoaded(overview, ({ view }) => ({ view, comparing }))),
    recentRuns: mapLoaded(loadedOf(recentQuery), (list) => list.items.map(describeRunRow)),
  };
}
