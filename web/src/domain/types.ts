/** 서버 API가 돌려주는 모양(Admin_Docs/overview/api-list.md). 칸 이름은 서버 그대로 snake_case다. */

export type RunMode = 'free' | 'interval' | 'cadence' | 'pacemaker';
export type SegmentKind = 'run' | 'walk' | 'km';

export type User = { id: string; email: string; weekly_goal: number };

export type RunSummary = {
  id: string;
  mode: RunMode;
  config: Record<string, number | null>;
  plan_label: string | null;
  started_at: string;
  ended_at: string;
  elapsed_s: number;
  distance_m: number;
  avg_pace_s_per_km: number | null;
  counted: boolean;
};

export type RunSegment = {
  idx: number;
  kind: SegmentKind;
  started_elapsed_s: number;
  duration_s: number;
  distance_m: number;
};

/** [위도, 경도, 경과 초] */
export type RoutePoint = [number, number, number];

export type RunDetail = RunSummary & { segments: RunSegment[]; route: RoutePoint[] };

export type RunList = { items: RunSummary[]; next_cursor: string | null };

export type StatsPeriod = 'month' | 'year';

export type StatsBucket = { label: string; start: string; distance_m: number; count: number; elapsed_s: number };

export type Stats = {
  period: StatsPeriod;
  /** 기간 첫날 "YYYY-MM-DD" */
  start: string;
  /** 기간 끝 다음 날 */
  end: string;
  buckets: StatsBucket[];
  totals: { distance_m: number; count: number; elapsed_s: number };
  goal_weeks: { achieved: number; total: number };
  weekly_goal: number;
};
