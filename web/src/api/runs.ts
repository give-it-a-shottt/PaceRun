/** 러닝 · 통계를 서버에서 읽는 함수들. 화면은 TanStack Query로 이 함수들을 부른다. */
import { previousComparable } from '../domain/runView';
import type { RunDetail, RunList, RunSummary, Stats, StatsPeriod } from '../domain/types';
import { authorizedGet } from './session';

/** 서버가 한 번에 주는 가장 큰 쪽 크기 */
const MAX_PAGE_SIZE = 100;
/** 목록을 끝없이 넘기지 않게 하는 안전장치 */
const MAX_PAGES = 20;

export function fetchStats(period: StatsPeriod, anchor: string, tz: string): Promise<Stats> {
  const query = new URLSearchParams({ period, anchor, tz });
  return authorizedGet<Stats>(`/stats?${query}`);
}

export function fetchRunsPage(cursor: string | null, limit: number): Promise<RunList> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return authorizedGet<RunList>(`/runs?${query}`);
}

export function fetchRun(id: string): Promise<RunDetail> {
  return authorizedGet<RunDetail>(`/runs/${encodeURIComponent(id)}`);
}

/**
 * 그 시각 뒤에 시작한 러닝을 모두 읽는다(주 목표 카드용). 목록은 최신순이라, 그 시각보다 앞선 러닝이 나오면 멈춘다.
 */
export async function fetchRunsSince(sinceMs: number): Promise<RunSummary[]> {
  const runs: RunSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const list: RunList = await fetchRunsPage(cursor, MAX_PAGE_SIZE);
    for (const run of list.items) {
      if (Date.parse(run.started_at) < sinceMs) return runs;
      runs.push(run);
    }
    if (!list.next_cursor) return runs;
    cursor = list.next_cursor;
  }
  return runs;
}

/**
 * 같은 모드의 바로 앞 기록을 찾는다(러닝 상세의 "지난번 비교"). 목록을 최신순으로 넘기며 찾고, 찾으면 멈춘다.
 * 없으면 null.
 */
export async function fetchPreviousComparable(run: RunSummary): Promise<RunSummary | null> {
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const list: RunList = await fetchRunsPage(cursor, MAX_PAGE_SIZE);
    // 한 쪽 안에서는 가장 최근 것이 답이다. 쪽은 최신순이므로 앞쪽에서 찾으면 뒤쪽을 볼 필요가 없다.
    const found = previousComparable(run, list.items);
    if (found) return found;
    if (!list.next_cursor) return null;
    cursor = list.next_cursor;
  }
  return null;
}
