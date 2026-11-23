/** 대시보드의 상태(기간 단위 · 기준 날짜 · 그릴 값)를 주소의 쿼리와 주고받는다. 새로 고침 · 뒤로 가기에 남게 하려는 것이다. */
import { clampAnchor, isCurrentPeriod, type Metric } from '../../domain/dashboard';
import type { StatsPeriod } from '../../domain/types';

export type DashboardQuery = { period: StatsPeriod; anchor: string; metric: Metric };

const DEFAULT_PERIOD: StatsPeriod = 'month';
const DEFAULT_METRIC: Metric = 'distance';
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isPeriod(value: string | null): value is StatsPeriod {
  return value === 'month' || value === 'year';
}

function isMetric(value: string | null): value is Metric {
  return value === 'distance' || value === 'count' || value === 'time';
}

/** "YYYY-MM-DD" 모양이고 달력에 있는 날짜인가(2월 30일 같은 값을 거른다) */
function isDateText(value: string | null): value is string {
  const match = value ? DATE_PATTERN.exec(value) : null;
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/**
 * 쿼리를 읽는다. 없거나 모르는 값이면 기본값(이번 달 · 거리)으로 본다.
 * 기준 날짜는 서버가 받는 범위 안으로 맞춘다: 오늘보다 뒤면 오늘(아직 오지 않은 기간은 보여 줄 것이 없다),
 * 가장 이른 날짜(2000-01-01)보다 앞이면 그 날짜.
 */
export function parseDashboardQuery(params: URLSearchParams, today: string): DashboardQuery {
  const period = params.get('period');
  const metric = params.get('metric');
  const anchor = params.get('anchor');
  return {
    period: isPeriod(period) ? period : DEFAULT_PERIOD,
    anchor: isDateText(anchor) ? clampAnchor(anchor, today) : today,
    metric: isMetric(metric) ? metric : DEFAULT_METRIC,
  };
}

/**
 * 쿼리 글자로 바꾼다("?period=year&anchor=2025-01-01"). 기본값은 적지 않는다.
 * 오늘이 든 기간이면 기준 날짜도 적지 않는다 — 월 ↔ 년을 오갈 때 "지금"에 머물게 하려는 것이다.
 */
export function toDashboardSearch(query: DashboardQuery, today: string): string {
  const params = new URLSearchParams();
  if (query.period !== DEFAULT_PERIOD) params.set('period', query.period);
  if (!isCurrentPeriod(query.period, query.anchor, today)) params.set('anchor', query.anchor);
  if (query.metric !== DEFAULT_METRIC) params.set('metric', query.metric);
  const text = params.toString();
  return text ? `?${text}` : '';
}
