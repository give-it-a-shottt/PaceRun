import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countUnsyncedRuns,
  getRun,
  getRunPoints,
  getRunSegments,
  insertDownloadedRun,
  listRunIds,
  listUnsyncedRunIds,
  markRunSynced,
  type RunRecord,
} from '@/db/runsRepo';
import { saveSetting } from '@/db/settingsRepo';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { DEFAULT_SETTINGS } from '@/domain/types';

import { ApiError, NetworkError } from './apiClient';
import { authorizedRequest, SessionExpiredError } from './session';
import { refreshLocalOnlyCount, requestBackgroundSync, syncNow } from './sync';

// DB와 서버 요청을 가짜로 바꿔 "무엇을 올리고, 실패하면 어디서 멈추고, 무엇을 남기는지"를 본다.
vi.mock('@/db/runsRepo', () => ({
  countUnsyncedRuns: vi.fn(),
  getRun: vi.fn(),
  getRunPoints: vi.fn(),
  getRunSegments: vi.fn(),
  insertDownloadedRun: vi.fn(),
  listRunIds: vi.fn(),
  listUnsyncedRunIds: vi.fn(),
  markRunSynced: vi.fn(),
}));
vi.mock('@/db/settingsRepo', () => ({ loadSettings: vi.fn(), saveSetting: vi.fn() }));
vi.mock('./session', () => ({
  authorizedRequest: vi.fn(),
  SessionExpiredError: class SessionExpiredError extends Error {},
}));

const request = vi.mocked(authorizedRequest);
const STARTED_AT = Date.UTC(2026, 10, 19, 22, 12);

function record(id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id,
    mode: 'free',
    config: { mode: 'free', targetDurationSec: 600 },
    planLabel: null,
    startedAt: STARTED_AT,
    endedAt: STARTED_AT + 11 * 60_000,
    status: 'finished',
    elapsedMs: 10 * 60_000,
    distanceM: 1500,
    avgPaceSecPerKm: 400,
    counted: true,
    syncState: 'local',
    ...overrides,
  };
}

const serverRun = (id: string) => ({
  id,
  mode: 'free',
  config: { target_duration_sec: null },
  plan_label: null,
  started_at: '2026-11-10T22:00:00Z',
  ended_at: '2026-11-10T22:20:00Z',
  elapsed_s: 1200,
  distance_m: 3000,
  avg_pace_s_per_km: 400,
  counted: true,
  segments: [],
  route: [],
});

/** 요청 종류별로 답을 정한다. 정하지 않은 요청은 성공(빈 답)이다. */
function respondWith(handlers: Partial<Record<string, (path: string, body: unknown) => unknown>>) {
  request.mockImplementation(async (method, path, body) => {
    const key = `${method} ${path.split('?')[0].replace(/\/runs\/.+/, '/runs/:id')}`;
    return (handlers[key]?.(path, body) ?? {}) as never;
  });
}

let syncTestNo = 0;

beforeEach(() => {
  vi.resetAllMocks();
  // 주 목표를 "마지막으로 올린 값"으로 기억하므로, 테스트마다 다른 값을 써서 매번 올리게 한다(2~5 안에서 돌린다)
  syncTestNo += 1;
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, weeklyGoal: 2 + (syncTestNo % 4) }, status: 'ready' });
  // 로그아웃 상태를 거쳐 가면 모듈이 기억하던 것(받지 않은 기록 · 올린 주 목표)이 지워진다
  useAuthStore.setState({ status: 'signedOut' });
  useAuthStore.setState({ status: 'signedIn', email: 'runner@example.com', syncing: false, syncProblem: null, localOnlyCount: null, unsendableCount: 0 });
  vi.mocked(listUnsyncedRunIds).mockResolvedValue([]);
  vi.mocked(listRunIds).mockResolvedValue([]);
  vi.mocked(countUnsyncedRuns).mockResolvedValue(0);
  vi.mocked(getRunSegments).mockResolvedValue([]);
  vi.mocked(getRunPoints).mockResolvedValue([]);
  vi.mocked(getRun).mockImplementation(async (id) => record(id));
  vi.mocked(insertDownloadedRun).mockResolvedValue(true);
  vi.mocked(saveSetting).mockResolvedValue(undefined);
  respondWith({});
});

describe('올리기', () => {
  it('올리지 않은 러닝을 차례로 올리고 올라간 것으로 표시한다', async () => {
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['a', 'b']);

    await syncNow({ download: false });

    const puts = request.mock.calls.filter(([method]) => method === 'PUT');
    expect(puts.map(([, path]) => path)).toEqual(['/runs/a', '/runs/b']);
    expect(puts[0][2]).toMatchObject({ mode: 'free', elapsed_s: 600, config: { target_duration_sec: 600 } });
    expect(vi.mocked(markRunSynced).mock.calls).toEqual([['a'], ['b']]);
    expect(useAuthStore.getState()).toMatchObject({ syncing: false, syncProblem: null, unsendableCount: 0 });
  });

  it('끝나면 마지막 동기화 시각을 적고 폰에만 있는 기록 수를 다시 센다', async () => {
    vi.mocked(countUnsyncedRuns).mockResolvedValue(0);
    const before = Date.now();

    await syncNow({ download: false });

    expect(useSettingsStore.getState().settings.lastSyncAt).toBeGreaterThanOrEqual(before);
    expect(saveSetting).toHaveBeenCalledWith('lastSyncAt', expect.any(Number));
    expect(useAuthStore.getState().localOnlyCount).toBe(0);
  });

  it('주 목표를 서버에 올린다(폰의 값이 기준). 같은 값이면 다시 올리지 않는다', async () => {
    const goal = useSettingsStore.getState().settings.weeklyGoal;

    await syncNow({ download: false });
    await syncNow({ download: false });

    const patches = request.mock.calls.filter(([method]) => method === 'PATCH');
    expect(patches).toEqual([['PATCH', '/me', { weekly_goal: goal }]]);
  });

  it('서버 상한을 넘는 러닝은 보내지 않고 "올릴 수 없는 기록"으로 센다', async () => {
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['long', 'ok']);
    vi.mocked(getRun).mockImplementation(async (id) => record(id, id === 'long' ? { elapsedMs: 25 * 3_600_000 } : {}));

    await syncNow({ download: false });

    expect(request.mock.calls.filter(([method]) => method === 'PUT').map(([, path]) => path)).toEqual(['/runs/ok']);
    expect(markRunSynced).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().unsendableCount).toBe(1);
  });

  it('서버가 받지 않은 러닝(409 · 422)은 건너뛰고 나머지를 계속 올린다. 그 러닝은 다시 보내지 않는다', async () => {
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['taken', 'ok']);
    respondWith({
      'PUT /runs/:id': (path) => {
        if (path === '/runs/taken') throw new ApiError(409, 'RUN_ID_CONFLICT', '다른 회원의 번호');
        return {};
      },
    });

    await syncNow({ download: false });
    expect(vi.mocked(markRunSynced).mock.calls).toEqual([['ok']]);
    expect(useAuthStore.getState()).toMatchObject({ unsendableCount: 1, syncProblem: null });

    request.mockClear();
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['taken']);
    await syncNow({ download: false });
    expect(request.mock.calls.filter(([method]) => method === 'PUT')).toEqual([]);
    expect(useAuthStore.getState().unsendableCount).toBe(1);
  });

  it('읽을 수 없는 러닝은 올릴 수 없는 기록으로 세고 넘어간다', async () => {
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['broken', 'ok']);
    vi.mocked(getRun).mockImplementation(async (id) => {
      if (id === 'broken') throw new SyntaxError('config_json');
      return record(id);
    });

    await syncNow({ download: false });

    expect(vi.mocked(markRunSynced).mock.calls).toEqual([['ok']]);
    expect(useAuthStore.getState().unsendableCount).toBe(1);
  });
});

describe('도중에 실패했을 때', () => {
  it('서버에 닿지 못하면 거기서 멈추고, 올리지 못한 러닝은 그대로 남는다', async () => {
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['a', 'b', 'c']);
    vi.mocked(countUnsyncedRuns).mockResolvedValue(2);
    respondWith({
      'PUT /runs/:id': (path) => {
        if (path === '/runs/b') throw new NetworkError();
        return {};
      },
    });

    await syncNow({ download: true });

    expect(vi.mocked(markRunSynced).mock.calls).toEqual([['a']]);
    expect(request.mock.calls.some(([, path]) => path === '/runs/c')).toBe(false);
    // 내려받기도 하지 않고, 마지막 동기화 시각도 적지 않는다
    expect(listRunIds).not.toHaveBeenCalled();
    expect(saveSetting).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ syncing: false, syncProblem: 'offline', localOnlyCount: 2 });
  });

  it('로그인이 만료되면 만료로 알린다(올릴 기록은 남는다)', async () => {
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['a']);
    request.mockRejectedValue(new SessionExpiredError());

    await syncNow({ download: false });

    expect(markRunSynced).not.toHaveBeenCalled();
    expect(useAuthStore.getState().syncProblem).toBe('expired');
  });

  it('서버 오류(500)는 서버 문제로 알린다', async () => {
    vi.mocked(listUnsyncedRunIds).mockResolvedValue(['a']);
    respondWith({
      'PUT /runs/:id': () => {
        throw new ApiError(500, 'INTERNAL', '서버 오류');
      },
    });

    await syncNow({ download: false });

    expect(markRunSynced).not.toHaveBeenCalled();
    expect(useAuthStore.getState().syncProblem).toBe('server');
  });

  it('오류를 던지지 않는다', async () => {
    vi.mocked(listUnsyncedRunIds).mockRejectedValue(new Error('disk'));
    await expect(syncNow({ download: false })).resolves.toBeUndefined();
    expect(useAuthStore.getState()).toMatchObject({ syncing: false, syncProblem: 'server' });
  });
});

describe('내려받기', () => {
  it('서버에만 있는 러닝을 받아 폰에 넣는다. 폰에 있는 번호는 다시 받지 않는다', async () => {
    vi.mocked(listRunIds).mockResolvedValue(['mine']);
    respondWith({
      'GET /runs': () => ({ items: [{ id: 'mine' }, { id: 'other' }], next_cursor: null }),
      'GET /runs/:id': (path) => serverRun(path.split('/').pop()!),
    });

    await syncNow({ download: true });

    expect(request.mock.calls.filter(([method, path]) => method === 'GET' && path.startsWith('/runs/'))).toEqual([
      ['GET', '/runs/other'],
    ]);
    expect(insertDownloadedRun).toHaveBeenCalledTimes(1);
    expect(vi.mocked(insertDownloadedRun).mock.calls[0][0]).toMatchObject({
      id: 'other',
      config: { mode: 'free', targetDurationSec: null },
      elapsedMs: 1_200_000,
      counted: true,
    });
  });

  it('목록을 끝까지 넘긴다(다음 쪽 표시를 그대로 돌려보낸다)', async () => {
    const pages: Record<string, unknown> = {
      '': { items: [{ id: 'r1' }], next_cursor: 'c 1' },
      'c 1': { items: [{ id: 'r2' }], next_cursor: null },
    };
    respondWith({
      'GET /runs': (path) => pages[decodeURIComponent(path.split('cursor=')[1] ?? '')],
      'GET /runs/:id': (path) => serverRun(path.split('/').pop()!),
    });

    await syncNow({ download: true });

    const lists = request.mock.calls.filter(([method, path]) => method === 'GET' && path.startsWith('/runs?')).map(([, path]) => path);
    expect(lists).toEqual(['/runs?limit=100', '/runs?limit=100&cursor=c%201']);
    expect(insertDownloadedRun).toHaveBeenCalledTimes(2);
  });

  it('모양이 틀린 기록은 폰에 넣지 않고 넘어간다', async () => {
    respondWith({
      'GET /runs': () => ({ items: [{ id: 'bad' }, { id: 'good' }], next_cursor: null }),
      'GET /runs/:id': (path) => (path.endsWith('/bad') ? { id: 'bad', mode: 'swim' } : serverRun('good')),
    });

    await syncNow({ download: true });

    expect(vi.mocked(insertDownloadedRun).mock.calls.map(([run]) => run.id)).toEqual(['good']);
    expect(useAuthStore.getState().syncProblem).toBeNull();
  });

  it('목록의 모양이 틀리면 서버 문제로 알리고 멈춘다', async () => {
    respondWith({ 'GET /runs': () => ({ rows: [] }) });
    await syncNow({ download: true });
    expect(useAuthStore.getState().syncProblem).toBe('server');
    expect(saveSetting).not.toHaveBeenCalled();
  });

  it('올리기만 할 때는 목록을 읽지 않는다', async () => {
    await syncNow({ download: false });
    expect(request.mock.calls.some(([method]) => method === 'GET')).toBe(false);
  });
});

describe('겹쳐 부를 때 · 로그인하지 않았을 때', () => {
  it('도는 중에 다시 부르면 겹쳐 돌리지 않고, 끝난 뒤 한 번 더 돈다(내려받기 요청도 잊지 않는다)', async () => {
    let releaseFirst: () => void = () => {};
    vi.mocked(listUnsyncedRunIds)
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = () => resolve([]))))
      .mockResolvedValue([]);
    respondWith({ 'GET /runs': () => ({ items: [], next_cursor: null }) });

    const first = syncNow({ download: false });
    const second = syncNow({ download: true });
    const third = syncNow({ download: false });
    expect(second).toBe(first);
    expect(third).toBe(first);
    // 주 목표 올리기가 끝나 첫 목록 읽기에 들어갈 때까지 기다린다
    await vi.waitFor(() => expect(listUnsyncedRunIds).toHaveBeenCalledTimes(1));

    releaseFirst();
    await first;

    expect(listUnsyncedRunIds).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.filter(([method, path]) => method === 'GET' && path.startsWith('/runs?'))).toHaveLength(1);
  });

  it('로그인돼 있지 않으면 아무것도 보내지 않는다', async () => {
    useAuthStore.setState({ status: 'expired' });

    await syncNow({ download: true });
    requestBackgroundSync();

    expect(request).not.toHaveBeenCalled();
    expect(listUnsyncedRunIds).not.toHaveBeenCalled();
  });

  it('폰에만 있는 기록 수를 세지 못해도 던지지 않는다', async () => {
    vi.mocked(countUnsyncedRuns).mockRejectedValue(new Error('disk'));
    useAuthStore.setState({ localOnlyCount: 3 });
    await expect(refreshLocalOnlyCount()).resolves.toBeUndefined();
    expect(useAuthStore.getState().localOnlyCount).toBe(3);
  });
});
