import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from './client';
import { fetchPreviousComparable, fetchRunsSince } from './runs';
import {
  authorizedGet,
  getSessionState,
  logIn,
  logOut,
  resetSessionForTest,
  restoreSession,
  SessionExpiredError,
  subscribeSession,
} from './session';

// 브라우저의 fetch를 가짜로 바꿔 "토큰을 어디에 싣고, 언제 다시 받고, 언제 로그인이 풀린 것으로 보는지"를 본다.
const fetchMock = vi.fn();

type Reply = { status: number; body?: unknown };
const user = { id: 'u1', email: 'runner@example.com', weekly_goal: 3 };
const token = (n: number) => ({ access_token: `access-${n}`, refresh_token: null, token_type: 'bearer', expires_in: 1800 });
const unauthorized: Reply = { status: 401, body: { detail: { code: 'UNAUTHORIZED', message: '만료' } } };

/** 주소(경로)별로 차례대로 줄 답을 정한다. 마지막 답은 되풀이된다. */
function serve(routes: Record<string, Reply[]>) {
  const used: Record<string, number> = {};
  fetchMock.mockImplementation(async (url: string) => {
    const path = Object.keys(routes).find((key) => url.split('?')[0].endsWith(key));
    if (!path) throw new Error(`가짜 서버가 모르는 주소: ${url}`);
    const index = Math.min(used[path] ?? 0, routes[path].length - 1);
    used[path] = (used[path] ?? 0) + 1;
    const reply = routes[path][index];
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      json: async () => {
        if (reply.body === undefined) throw new SyntaxError('no body');
        return reply.body;
      },
    } as Response;
  });
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).split('?')[0].endsWith(path));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  resetSessionForTest();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('사이트를 열 때', () => {
  it('쿠키로 액세스 토큰을 받고 내 정보를 읽어 로그인된 상태가 된다', async () => {
    serve({ '/auth/refresh': [{ status: 200, body: token(1) }], '/me': [{ status: 200, body: user }] });

    await restoreSession();

    expect(getSessionState()).toEqual({ status: 'signedIn', user });
    const [, refreshInit] = callsTo('/auth/refresh')[0];
    // 리프레시 토큰은 쿠키로만 다닌다: 쿠키를 싣고, 쿠키 방식 머리글을 붙이고, 본문에는 아무것도 넣지 않는다
    expect(refreshInit.credentials).toBe('include');
    expect(refreshInit.headers['X-Refresh-Mode']).toBe('cookie');
    expect(refreshInit.body).toBeUndefined();
    const [, meInit] = callsTo('/me')[0];
    expect(meInit.headers.Authorization).toBe('Bearer access-1');
    expect(meInit.credentials).toBe('omit');
  });

  it('쿠키가 없거나 만료됐으면 로그인 안 된 상태로 연다(던지지 않는다)', async () => {
    serve({ '/auth/refresh': [{ status: 401, body: { detail: { code: 'INVALID_REFRESH', message: '없음' } } }] });
    await expect(restoreSession()).resolves.toBeUndefined();
    expect(getSessionState()).toEqual({ status: 'signedOut', user: null });
  });

  it('서버에 닿지 못해도 로그인 안 된 상태로 연다', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    await restoreSession();
    expect(getSessionState().status).toBe('signedOut');
  });

  it('여러 번 불러도 한 번만 다녀온다', async () => {
    serve({ '/auth/refresh': [{ status: 200, body: token(1) }], '/me': [{ status: 200, body: user }] });
    await Promise.all([restoreSession(), restoreSession()]);
    expect(callsTo('/auth/refresh')).toHaveLength(1);
  });

  it('상태가 바뀌면 듣는 쪽에 알린다', async () => {
    serve({ '/auth/refresh': [{ status: 200, body: token(1) }], '/me': [{ status: 200, body: user }] });
    const listener = vi.fn();
    const unsubscribe = subscribeSession(listener);

    await restoreSession();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    serve({ '/auth/logout': [{ status: 204 }] });
    await logOut();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('로그인 · 로그아웃', () => {
  it('로그인하면 쿠키 방식으로 보내고, 받은 액세스 토큰을 메모리에만 둔다', async () => {
    serve({ '/auth/login': [{ status: 200, body: { ...token(1), user } }], '/runs/abc': [{ status: 200, body: { id: 'abc' } }] });

    await logIn(user.email, 'password1');

    expect(getSessionState()).toEqual({ status: 'signedIn', user });
    const [, init] = callsTo('/auth/login')[0];
    expect(init.credentials).toBe('include');
    expect(init.headers['X-Refresh-Mode']).toBe('cookie');
    expect(JSON.parse(init.body)).toEqual({ email: user.email, password: 'password1' });

    // 바로 이어지는 조회는 갱신 없이 그 토큰을 쓴다
    await authorizedGet('/runs/abc');
    expect(callsTo('/auth/refresh')).toHaveLength(0);
    expect(callsTo('/runs/abc')[0][1].headers.Authorization).toBe('Bearer access-1');
  });

  it('틀린 비밀번호면 오류를 그대로 올리고 상태는 바뀌지 않는다', async () => {
    serve({ '/auth/login': [{ status: 401, body: { detail: { code: 'INVALID_CREDENTIALS', message: '틀림' } } }] });
    await expect(logIn(user.email, 'wrong')).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(getSessionState().status).toBe('loading');
  });

  it('서버에 닿지 못하면 NetworkError다', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    await expect(logIn(user.email, 'password1')).rejects.toBeInstanceOf(NetworkError);
  });

  it('로그아웃하면 서버에 쿠키 폐기를 알리고 로그인 안 된 상태가 된다. 서버에 닿지 못해도 그렇다', async () => {
    serve({ '/auth/login': [{ status: 200, body: { ...token(1), user } }], '/auth/logout': [{ status: 204 }] });
    await logIn(user.email, 'password1');

    await logOut();
    expect(getSessionState()).toEqual({ status: 'signedOut', user: null });
    expect(callsTo('/auth/logout')[0][1].credentials).toBe('include');

    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    await expect(logOut()).resolves.toBeUndefined();
  });
});

describe('로그인이 필요한 조회', () => {
  async function signedIn(routes: Record<string, Reply[]>) {
    serve({ '/auth/login': [{ status: 200, body: { ...token(1), user } }], ...routes });
    await logIn(user.email, 'password1');
    fetchMock.mockClear();
  }

  it('401을 받으면 쿠키로 토큰을 다시 받아 한 번 더 보낸다', async () => {
    await signedIn({
      '/stats': [unauthorized, { status: 200, body: { ok: true } }],
      '/auth/refresh': [{ status: 200, body: token(2) }],
    });

    expect(await authorizedGet('/stats?period=month')).toEqual({ ok: true });
    expect(callsTo('/auth/refresh')).toHaveLength(1);
    expect(callsTo('/stats')[1][1].headers.Authorization).toBe('Bearer access-2');
  });

  it('쿠키도 받지 않으면 로그인이 풀린 것으로 보고 상태를 바꾼다', async () => {
    await signedIn({
      '/stats': [unauthorized],
      '/auth/refresh': [{ status: 401, body: { detail: { code: 'INVALID_REFRESH', message: '폐기됨' } } }],
    });

    await expect(authorizedGet('/stats')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getSessionState()).toEqual({ status: 'signedOut', user: null });
  });

  it('다시 받은 토큰으로도 401이면 로그인이 풀린 것으로 본다(끝없이 다시 보내지 않는다)', async () => {
    await signedIn({ '/stats': [unauthorized], '/auth/refresh': [{ status: 200, body: token(2) }] });

    await expect(authorizedGet('/stats')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(callsTo('/stats')).toHaveLength(2);
    expect(getSessionState().status).toBe('signedOut');
  });

  it('동시에 여러 조회가 401을 받아도 토큰은 한 번만 다시 받는다', async () => {
    await signedIn({
      '/stats': [unauthorized, { status: 200, body: { ok: 1 } }],
      '/runs': [unauthorized, { status: 200, body: { ok: 2 } }],
      '/auth/refresh': [{ status: 200, body: token(2) }],
    });

    await Promise.all([authorizedGet('/stats'), authorizedGet('/runs')]);
    expect(callsTo('/auth/refresh')).toHaveLength(1);
  });

  it('401이 아닌 거절 · 연결 실패는 그대로 올리고 로그인은 유지한다', async () => {
    await signedIn({ '/runs/none': [{ status: 404, body: { detail: { code: 'RUN_NOT_FOUND', message: '없음' } } }] });
    await expect(authorizedGet('/runs/none')).rejects.toBeInstanceOf(ApiError);
    expect(getSessionState().status).toBe('signedIn');

    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    await expect(authorizedGet('/stats')).rejects.toBeInstanceOf(NetworkError);
    expect(getSessionState().status).toBe('signedIn');
  });
});

describe('러닝 목록 넘기기', () => {
  const summary = (id: string, startedAt: string, extra: object = {}) => ({
    id,
    mode: 'interval',
    config: {},
    plan_label: null,
    started_at: startedAt,
    ended_at: startedAt,
    elapsed_s: 1200,
    distance_m: 3000,
    avg_pace_s_per_km: 400,
    counted: true,
    ...extra,
  });

  async function withPages(pages: Reply[]) {
    serve({ '/auth/login': [{ status: 200, body: { ...token(1), user } }], '/runs': pages });
    await logIn(user.email, 'password1');
    fetchMock.mockClear();
  }

  it('그 시각 뒤의 러닝만 모으고, 그보다 앞선 러닝이 나오면 다음 쪽을 읽지 않는다', async () => {
    await withPages([
      { status: 200, body: { items: [summary('a', '2026-11-20T00:00:00Z'), summary('b', '2026-11-10T00:00:00Z')], next_cursor: 'c1' } },
      { status: 200, body: { items: [summary('c', '2026-10-01T00:00:00Z')], next_cursor: null } },
    ]);

    const runs = await fetchRunsSince(Date.parse('2026-11-15T00:00:00Z'));

    expect(runs.map((run) => run.id)).toEqual(['a']);
    expect(callsTo('/runs')).toHaveLength(1);
  });

  it('끝까지 읽어도 되면 다음 쪽 표시를 그대로 돌려보내며 넘긴다', async () => {
    await withPages([
      { status: 200, body: { items: [summary('a', '2026-11-20T00:00:00Z')], next_cursor: 'c 1' } },
      { status: 200, body: { items: [summary('b', '2026-11-18T00:00:00Z')], next_cursor: null } },
    ]);

    const runs = await fetchRunsSince(Date.parse('2026-11-01T00:00:00Z'));

    expect(runs.map((run) => run.id)).toEqual(['a', 'b']);
    expect(String(callsTo('/runs')[1][0])).toContain('cursor=c+1');
  });

  it('같은 모드의 지난 기록을 찾으면 거기서 멈추고, 끝까지 없으면 null이다', async () => {
    const current = summary('now', '2026-11-20T00:00:00Z') as never;
    await withPages([
      { status: 200, body: { items: [current, summary('free', '2026-11-19T00:00:00Z', { mode: 'free' })], next_cursor: 'c1' } },
      { status: 200, body: { items: [summary('prev', '2026-11-10T00:00:00Z')], next_cursor: 'c2' } },
      { status: 200, body: { items: [summary('older', '2026-11-01T00:00:00Z')], next_cursor: null } },
    ]);
    expect((await fetchPreviousComparable(current))?.id).toBe('prev');
    expect(callsTo('/runs')).toHaveLength(2);

    await withPages([{ status: 200, body: { items: [current], next_cursor: null } }]);
    expect(await fetchPreviousComparable(current)).toBeNull();
  });
});
