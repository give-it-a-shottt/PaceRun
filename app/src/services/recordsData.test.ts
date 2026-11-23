import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listPlanItems } from '@/db/planRepo';
import { getRun, getRunPoints, getRunSegments, listRunDigests, type RunRecord } from '@/db/runsRepo';

import { loadRecords, loadRunDetailView, loadSummaryView } from './recordsData';

// DB(expo-sqlite)는 폰에서만 돌므로 저장소 함수만 가짜로 바꿔, "무엇을 읽어 무엇을 돌려주는지"를 본다.
vi.mock('@/db/planRepo', () => ({ listPlanItems: vi.fn() }));
vi.mock('@/db/runsRepo', () => ({
  getRun: vi.fn(),
  getRunPoints: vi.fn(),
  getRunSegments: vi.fn(),
  listRunDigests: vi.fn(),
}));

const STARTED_AT = new Date(2026, 10, 19, 7, 12).getTime();

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: 'run-1',
    mode: 'interval',
    config: { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 },
    planLabel: '인터벌 입문 3회차',
    startedAt: STARTED_AT,
    endedAt: STARTED_AT + 20 * 60_000,
    status: 'finished',
    elapsedMs: 20 * 60_000,
    distanceM: 3120,
    avgPaceSecPerKm: 362,
    counted: true,
    syncState: 'local',
    ...overrides,
  };
}

const digest = {
  id: 'run-1',
  mode: 'interval' as const,
  planLabel: '인터벌 입문 3회차',
  startedAt: STARTED_AT,
  elapsedMs: 20 * 60_000,
  distanceM: 3120,
  avgPaceSecPerKm: 362,
  counted: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listPlanItems).mockResolvedValue([]);
  vi.mocked(listRunDigests).mockResolvedValue([digest]);
  vi.mocked(getRunSegments).mockResolvedValue([
    { idx: 0, kind: 'run', startedElapsedMs: 0, durationMs: 60_000, distanceM: 180 },
  ]);
  vi.mocked(getRunPoints).mockResolvedValue([
    { lat: 37.5, lng: 127, t: STARTED_AT, accuracy: 5, elapsedMs: 0 },
    { lat: 37.501, lng: 127.001, t: STARTED_AT + 60_000, accuracy: 5, elapsedMs: 60_000 },
  ]);
});

describe('러닝 상세 읽기', () => {
  it('끝난 러닝이면 화면 값과 경로를 돌려준다', async () => {
    vi.mocked(getRun).mockResolvedValue(record());

    const detail = await loadRunDetailView('run-1');

    expect(detail?.view.title).toBe('인터벌 입문 3회차');
    expect(detail?.view.segments).toHaveLength(1);
    expect(detail?.route).toEqual([
      { lat: 37.5, lng: 127 },
      { lat: 37.501, lng: 127.001 },
    ]);
  });

  it('없는 번호면 null이고 구간 · 경로를 읽지 않는다', async () => {
    vi.mocked(getRun).mockResolvedValue(null);

    expect(await loadRunDetailView('none')).toBeNull();
    expect(getRunSegments).not.toHaveBeenCalled();
    expect(getRunPoints).not.toHaveBeenCalled();
  });

  it('아직 끝나지 않은 러닝은 없는 것으로 본다', async () => {
    vi.mocked(getRun).mockResolvedValue(record({ status: 'active', endedAt: null }));
    expect(await loadRunDetailView('run-1')).toBeNull();
  });

  it('읽다가 실패하면 오류를 그대로 올린다(화면이 실패 안내를 띄운다)', async () => {
    vi.mocked(getRun).mockResolvedValue(record());
    vi.mocked(getRunPoints).mockRejectedValue(new Error('disk'));
    await expect(loadRunDetailView('run-1')).rejects.toThrow('disk');
  });
});

describe('완료 요약 읽기', () => {
  it('끝난 러닝이면 화면 값과 경로를 돌려준다', async () => {
    vi.mocked(getRun).mockResolvedValue(record());

    const summary = await loadSummaryView('run-1', STARTED_AT + 21 * 60_000, 3);

    expect(summary?.view.week.title).toBe('이번 주 1 / 3회');
    expect(summary?.view.week.paintKey).toBe('run-1');
    expect(summary?.route).toHaveLength(2);
  });

  it('없는 번호이거나 끝나지 않은 러닝이면 null이다', async () => {
    vi.mocked(getRun).mockResolvedValue(null);
    expect(await loadSummaryView('none', STARTED_AT, 3)).toBeNull();

    vi.mocked(getRun).mockResolvedValue(record({ status: 'active', endedAt: null }));
    expect(await loadSummaryView('run-1', STARTED_AT, 3)).toBeNull();
  });
});

describe('기록 탭 읽기', () => {
  it('끝난 러닝과 계획을 읽어 화면 값으로 바꾼다', async () => {
    const view = await loadRecords(STARTED_AT + 21 * 60_000);
    expect(view.isEmpty).toBe(false);
    expect(view.totalText).toBe('3.1 km · 1회');
    expect(view.items.map((item) => item.id)).toEqual(['run-1']);
  });

  it('러닝이 하나도 없으면 빈 상태다', async () => {
    vi.mocked(listRunDigests).mockResolvedValue([]);
    expect((await loadRecords(STARTED_AT)).isEmpty).toBe(true);
  });
});
