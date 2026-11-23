import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DownloadedRun } from '@/domain/syncMapping';

// expo-sqlite는 폰에서만 돈다. runs · run_points · run_segments 표를 메모리에 흉내 낸 가짜 DB로
// 서버와 맞출 때 쓰는 함수들(올릴 것 찾기 · 올라간 것 표시 · 내려받은 러닝 넣기)을 본다.
type RunRow = { id: string; status: string; sync_state: string; started_at: number; mode: string; config_json: string };
type Tables = { runs: RunRow[]; points: { run_id: string; lat: number }[]; segments: { run_id: string; idx: number; kind: string }[] };

let tables: Tables = { runs: [], points: [], segments: [] };
/** 이 문장으로 시작하는 쓰기에서 실패하게 한다 */
let failOn: string | null = null;

const clone = (value: Tables): Tables => JSON.parse(JSON.stringify(value)) as Tables;

const fakeDb = {
  execAsync: vi.fn(async () => undefined),
  getFirstAsync: vi.fn(async (sql: string) => {
    if (sql.includes('PRAGMA user_version')) return { user_version: 99 };
    if (sql.includes('COUNT(*)')) {
      return { n: tables.runs.filter((run) => run.status === 'finished' && run.sync_state === 'local').length };
    }
    throw new Error(`가짜 DB가 모르는 SQL: ${sql}`);
  }),
  closeAsync: vi.fn(async () => undefined),
  getAllAsync: vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT id FROM runs WHERE status = 'finished' AND sync_state = 'local'")) {
      return tables.runs
        .filter((run) => run.status === 'finished' && run.sync_state === 'local')
        .sort((a, b) => a.started_at - b.started_at)
        .map((run) => ({ id: run.id }));
    }
    if (sql === 'SELECT id FROM runs') return tables.runs.map((run) => ({ id: run.id }));
    throw new Error(`가짜 DB가 모르는 SQL: ${sql}`);
  }),
  runAsync: vi.fn(async (sql: string, ...params: unknown[]) => {
    const text = sql.trim();
    if (failOn && text.startsWith(failOn)) throw new Error('disk full');
    if (text.startsWith("UPDATE runs SET sync_state = 'synced'")) {
      const run = tables.runs.find((row) => row.id === params[0]);
      if (run) run.sync_state = 'synced';
      return { changes: run ? 1 : 0 };
    }
    if (text.startsWith('INSERT OR IGNORE INTO runs')) {
      const [id, mode, config_json, , started_at] = params as [string, string, string, unknown, number];
      if (tables.runs.some((row) => row.id === id)) return { changes: 0 };
      tables.runs.push({ id, mode, config_json, started_at, status: 'finished', sync_state: 'synced' });
      return { changes: 1 };
    }
    if (text.startsWith('INSERT INTO run_points')) {
      // insertPoints는 값을 배열 하나로 넘긴다: (run_id, t, lat, lng, accuracy, elapsed_ms) × n
      const values = params[0] as unknown[];
      for (let index = 0; index < values.length; index += 6) {
        tables.points.push({ run_id: values[index] as string, lat: values[index + 2] as number });
      }
      return { changes: values.length / 6 };
    }
    if (text.startsWith('INSERT OR REPLACE INTO run_segments')) {
      const [run_id, idx, kind] = params as [string, number, string];
      tables.segments = tables.segments.filter((row) => !(row.run_id === run_id && row.idx === idx));
      tables.segments.push({ run_id, idx, kind });
      return { changes: 1 };
    }
    throw new Error(`가짜 DB가 모르는 SQL: ${text}`);
  }),
  withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
    const before = clone(tables);
    try {
      await task();
    } catch (error) {
      tables = before;
      throw error;
    }
  }),
};
vi.mock('expo-sqlite', () => ({ openDatabaseAsync: vi.fn(async () => fakeDb) }));

function row(id: string, overrides: Partial<RunRow> = {}): RunRow {
  return { id, status: 'finished', sync_state: 'local', started_at: 1000, mode: 'free', config_json: '{}', ...overrides };
}

function downloaded(id: string, pointCount = 3): DownloadedRun {
  return {
    id,
    mode: 'pacemaker',
    config: { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 },
    planLabel: null,
    startedAt: 5000,
    endedAt: 9000,
    elapsedMs: 4000,
    distanceM: 12,
    avgPaceSecPerKm: null,
    counted: false,
    segments: [
      { idx: 0, kind: 'km', startedElapsedMs: 0, durationMs: 2000, distanceM: 6 },
      { idx: 1, kind: 'km', startedElapsedMs: 2000, durationMs: 2000, distanceM: 6 },
    ],
    points: Array.from({ length: pointCount }, (_, index) => ({ lat: 37 + index, lng: 127, t: 5000 + index, accuracy: null, elapsedMs: index })),
  };
}

async function load() {
  vi.resetModules();
  return import('./runsRepo');
}

beforeEach(() => {
  tables = { runs: [], points: [], segments: [] };
  failOn = null;
  vi.clearAllMocks();
});

describe('올릴 러닝 찾기', () => {
  it('끝났고 아직 올리지 않은 러닝만, 오래된 것부터 돌려준다', async () => {
    tables.runs = [
      row('new', { started_at: 3000 }),
      row('synced', { sync_state: 'synced', started_at: 2000 }),
      row('running', { status: 'active', started_at: 2500 }),
      row('old', { started_at: 1000 }),
    ];
    const { listUnsyncedRunIds, countUnsyncedRuns, listRunIds } = await load();

    expect(await listUnsyncedRunIds()).toEqual(['old', 'new']);
    expect(await countUnsyncedRuns()).toBe(2);
    // 내려받을 때 견줄 번호에는 끝나지 않은 러닝도 들어간다
    expect((await listRunIds()).sort()).toEqual(['new', 'old', 'running', 'synced']);
  });

  it('올라간 것으로 표시하면 올릴 목록에서 빠진다', async () => {
    tables.runs = [row('a'), row('b')];
    const { markRunSynced, listUnsyncedRunIds } = await load();

    await markRunSynced('a');

    expect(await listUnsyncedRunIds()).toEqual(['b']);
  });
});

describe('내려받은 러닝 넣기', () => {
  it('러닝 · 경로 · 구간을 넣고, 이미 올라가 있는 기록으로 표시한다', async () => {
    const { insertDownloadedRun, listUnsyncedRunIds } = await load();

    expect(await insertDownloadedRun(downloaded('x'))).toBe(true);

    expect(tables.runs).toHaveLength(1);
    expect(tables.runs[0]).toMatchObject({ id: 'x', status: 'finished', sync_state: 'synced', mode: 'pacemaker' });
    expect(JSON.parse(tables.runs[0].config_json)).toEqual({ mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 });
    expect(tables.points.map((point) => point.lat)).toEqual([37, 38, 39]);
    expect(tables.segments.map((segment) => segment.idx)).toEqual([0, 1]);
    // 다시 올리지 않는다
    expect(await listUnsyncedRunIds()).toEqual([]);
  });

  it('같은 번호가 폰에 있으면 아무것도 넣지 않고 false다(폰의 기록을 덮어쓰지 않는다)', async () => {
    tables.runs = [row('x', { mode: 'free' })];
    const { insertDownloadedRun } = await load();

    expect(await insertDownloadedRun(downloaded('x'))).toBe(false);

    expect(tables.runs).toEqual([row('x', { mode: 'free' })]);
    expect(tables.points).toEqual([]);
    expect(tables.segments).toEqual([]);
  });

  it('점이 많으면 여러 문장으로 나눠 넣는다', async () => {
    const { insertDownloadedRun } = await load();
    await insertDownloadedRun(downloaded('x', 250));
    expect(tables.points).toHaveLength(250);
    expect(fakeDb.runAsync.mock.calls.filter(([sql]) => String(sql).trim().startsWith('INSERT INTO run_points'))).toHaveLength(3);
  });

  it('넣다가 중간에 실패하면 러닝 줄까지 모두 되돌린다(경로 없는 반쪽 기록이 남지 않는다)', async () => {
    const { insertDownloadedRun } = await load();
    failOn = 'INSERT OR REPLACE INTO run_segments';

    await expect(insertDownloadedRun(downloaded('x'))).rejects.toThrow('disk full');

    expect(tables).toEqual({ runs: [], points: [], segments: [] });
  });

  it('실패한 뒤에도 다음 넣기는 된다', async () => {
    const { insertDownloadedRun } = await load();
    failOn = 'INSERT INTO run_points';
    await expect(insertDownloadedRun(downloaded('x'))).rejects.toThrow();
    failOn = null;

    expect(await insertDownloadedRun(downloaded('x'))).toBe(true);
    expect(tables.runs).toHaveLength(1);
  });
});
