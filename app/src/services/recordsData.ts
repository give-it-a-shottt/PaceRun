/** 기록 탭 · 러닝 상세 · 완료 요약에 그릴 값을 만든다: 폰 DB에서 읽어 계산 함수(domain/records)에 넘긴다. */
import { listPlanItems } from '@/db/planRepo';
import { getRun, getRunPoints, getRunSegments, listRunDigests } from '@/db/runsRepo';
import {
  describeRecords,
  describeRunDetail,
  describeSummary,
  type RecordsView,
  type RunDetailView,
  type SummaryView,
} from '@/domain/records';
import type { RoutePosition } from '@/domain/route';

export type {
  ChartBarView,
  RecordsChartView,
  RecordsView,
  RunDetailView,
  RunListItemView,
  SegmentRowView,
  StatView,
  SummaryView,
} from '@/domain/records';
export type { ComparisonView } from '@/domain/compare';
export type { RoutePosition } from '@/domain/route';

/** 러닝 한 건의 화면 값과 경로(작은 지도용). 경로는 화면이 상자 크기에 맞춰 선으로 바꾼다. */
export type WithRoute<View> = { view: View; route: RoutePosition[] };

/** 기록 탭 */
export async function loadRecords(now: number): Promise<RecordsView> {
  const [plan, runs] = await Promise.all([listPlanItems(), listRunDigests()]);
  return describeRecords({ now, plan, runs });
}

/** 끝난 러닝만 보여 준다. 없는 번호이거나 아직 끝나지 않은 러닝이면 null */
async function getFinishedRun(id: string) {
  const run = await getRun(id);
  return run?.status === 'finished' ? run : null;
}

/** 러닝 상세. 없는 번호(또는 아직 끝나지 않은 러닝)면 null */
export async function loadRunDetailView(id: string): Promise<WithRoute<RunDetailView> | null> {
  const run = await getFinishedRun(id);
  if (!run) return null;
  const [segments, points, runs] = await Promise.all([getRunSegments(id), getRunPoints(id), listRunDigests()]);
  return { view: describeRunDetail({ run, segments, runs }), route: points.map(toPosition) };
}

/** 완료 요약. 없는 번호(또는 아직 끝나지 않은 러닝)면 null */
export async function loadSummaryView(id: string, now: number, weeklyGoal: number): Promise<WithRoute<SummaryView> | null> {
  const run = await getFinishedRun(id);
  if (!run) return null;
  const [points, runs, plan] = await Promise.all([getRunPoints(id), listRunDigests(), listPlanItems()]);
  return { view: describeSummary({ run, runs, plan, weeklyGoal, now }), route: points.map(toPosition) };
}

function toPosition(point: { lat: number; lng: number }): RoutePosition {
  return { lat: point.lat, lng: point.lng };
}
