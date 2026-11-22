/** 저장된 러닝을 화면에 넘겨 주는 곳. 화면은 DB를 직접 부르지 않고 여기를 거친다. */
import { getRun, getRunPoints, getRunSegments, type RunRecord } from '@/db/runsRepo';
import type { RunPoint, RunSegment } from '@/domain/runEngine';

export type { RunRecord } from '@/db/runsRepo';

export type RunDetail = {
  run: RunRecord;
  segments: RunSegment[];
  points: RunPoint[];
};

/** 러닝 한 건의 요약만. 없으면 null */
export function loadRun(id: string): Promise<RunRecord | null> {
  return getRun(id);
}

/** 러닝 한 건과 구간 · 경로. 없으면 null */
export async function loadRunDetail(id: string): Promise<RunDetail | null> {
  const run = await getRun(id);
  if (!run) return null;
  const [segments, points] = await Promise.all([getRunSegments(id), getRunPoints(id)]);
  return { run, segments, points };
}
