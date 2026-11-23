import { beforeEach, describe, expect, it, vi } from 'vitest';

// 보관함(expo-secure-store)과 서버 요청을 가짜로 바꿔 "언제 로그인으로 치고, 언제 만료로 보는지"를 본다.
const vault = new Map<string, string>();
let failVaultWrite = false;
/** 이 키를 넣을 때만 실패하게 한다 */
let failVaultWriteFor: string | null = null;

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => vault.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (failVaultWrite || failVaultWriteFor === key) throw new Error('keystore');
    vault.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    vault.delete(key);
  }),
}));

const REFRESH_KEY = 'pacerun.refreshToken';
const EMAIL_KEY = 'pacerun.email';

const user = { id: 'u1', email: 'runner@example.com', weekly_goal: 3 };
const authOut = (n: number) => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 1800, user });
const tokenOut = (n: number) => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 1800 });

/** 모듈이 액세스 토큰을 기억하므로 테스트마다 새로 불러온다. */
async function setup() {
  vi.resetModules();
  const api = await import('./apiClient');
  const apiRequest = vi.spyOn(api, 'apiRequest');
  const session = await import('./session');
  const { useAuthStore } = await import('@/state/authStore');
  return { apiRequest, session, useAuthStore, ApiError: api.ApiError, NetworkError: api.NetworkError };
}

beforeEach(() => {
  vault.clear();
  failVaultWrite = false;
  failVaultWriteFor = null;
  vi.restoreAllMocks();
});

describe('저장된 로그인 정보 읽기', () => {
  it('아무것도 없으면 로그인하지 않은 상태다', async () => {
    const { session, useAuthStore } = await setup();
    await session.restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', email: null });
  });

  it('리프레시 토큰이 있으면 로그인된 상태다(서버에는 묻지 않는다)', async () => {
    vault.set(REFRESH_KEY, 'refresh-1');
    vault.set(EMAIL_KEY, user.email);
    const { session, useAuthStore, apiRequest } = await setup();
    await session.restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', email: user.email });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('이메일만 남아 있으면 만료된 상태다', async () => {
    vault.set(EMAIL_KEY, user.email);
    const { session, useAuthStore } = await setup();
    await session.restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'expired', email: user.email });
  });
});

describe('로그인 · 가입 · 로그아웃', () => {
  it('로그인하면 리프레시 토큰과 이메일을 보관함에 넣고 로그인된 상태가 된다', async () => {
    const { session, useAuthStore, apiRequest } = await setup();
    apiRequest.mockResolvedValueOnce(authOut(1));

    await session.logIn(user.email, 'password1');

    expect(apiRequest).toHaveBeenCalledWith('POST', '/auth/login', { body: { email: user.email, password: 'password1' } });
    expect(vault.get(REFRESH_KEY)).toBe('refresh-1');
    expect(vault.get(EMAIL_KEY)).toBe(user.email);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', email: user.email });
  });

  it('가입도 같은 방식으로 로그인된 상태가 된다', async () => {
    const { session, useAuthStore, apiRequest } = await setup();
    apiRequest.mockResolvedValueOnce(authOut(1));
    await session.signUp(user.email, 'password1');
    expect(apiRequest).toHaveBeenCalledWith('POST', '/auth/signup', expect.anything());
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('서버가 거절하면 오류를 그대로 올리고 상태는 바뀌지 않는다', async () => {
    const { session, useAuthStore, apiRequest, ApiError } = await setup();
    useAuthStore.setState({ status: 'signedOut' });
    apiRequest.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS', '틀림'));

    await expect(session.logIn(user.email, 'wrong')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(vault.size).toBe(0);
  });

  it('토큰을 보관함에 넣지 못하면 로그인된 것으로 치지 않는다', async () => {
    const { session, useAuthStore, apiRequest } = await setup();
    useAuthStore.setState({ status: 'signedOut' });
    apiRequest.mockResolvedValueOnce(authOut(1));
    failVaultWrite = true;

    await expect(session.logIn(user.email, 'password1')).rejects.toThrow('keystore');
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('이메일을 보관함에 넣지 못하면 먼저 넣은 토큰도 도로 지운다(다음에 켰을 때 로그인돼 있지 않게)', async () => {
    const { session, useAuthStore, apiRequest } = await setup();
    useAuthStore.setState({ status: 'signedOut' });
    apiRequest.mockResolvedValueOnce(authOut(1));
    failVaultWriteFor = EMAIL_KEY;

    await expect(session.logIn(user.email, 'password1')).rejects.toThrow('keystore');

    expect(vault.size).toBe(0);
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('로그아웃하면 보관함을 비우고 서버에 폐기를 알린다', async () => {
    const { session, useAuthStore, apiRequest } = await setup();
    apiRequest.mockResolvedValueOnce(authOut(1));
    await session.logIn(user.email, 'password1');
    apiRequest.mockResolvedValueOnce(undefined);

    await session.logOut();

    expect(vault.size).toBe(0);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', email: null });
    expect(apiRequest).toHaveBeenLastCalledWith('POST', '/auth/logout', { body: { refresh_token: 'refresh-1' } });
  });

  it('서버에 닿지 못해도 폰에서는 로그아웃된다', async () => {
    const { session, useAuthStore, apiRequest, NetworkError } = await setup();
    apiRequest.mockResolvedValueOnce(authOut(1));
    await session.logIn(user.email, 'password1');
    apiRequest.mockRejectedValueOnce(new NetworkError());

    await expect(session.logOut()).resolves.toBeUndefined();
    expect(vault.size).toBe(0);
    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});

describe('로그인이 필요한 요청', () => {
  async function signedIn() {
    const env = await setup();
    env.apiRequest.mockResolvedValueOnce(authOut(1));
    await env.session.logIn(user.email, 'password1');
    env.apiRequest.mockClear();
    return env;
  }

  it('로그인할 때 받은 액세스 토큰을 붙여 보낸다', async () => {
    const { session, apiRequest } = await signedIn();
    apiRequest.mockResolvedValueOnce({ items: [] });

    await session.authorizedRequest('GET', '/runs');

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith('GET', '/runs', { body: undefined, accessToken: 'access-1' });
  });

  it('앱을 다시 켠 뒤(액세스 토큰이 없음)에는 먼저 갱신하고, 새 리프레시 토큰을 보관한다', async () => {
    vault.set(REFRESH_KEY, 'refresh-1');
    vault.set(EMAIL_KEY, user.email);
    const { session, apiRequest } = await setup();
    await session.restoreSession();
    apiRequest.mockResolvedValueOnce(tokenOut(2)).mockResolvedValueOnce({ ok: true });

    await session.authorizedRequest('PUT', '/runs/a', { mode: 'free' });

    expect(apiRequest).toHaveBeenNthCalledWith(1, 'POST', '/auth/refresh', { body: { refresh_token: 'refresh-1' } });
    expect(apiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/runs/a', { body: { mode: 'free' }, accessToken: 'access-2' });
    expect(vault.get(REFRESH_KEY)).toBe('refresh-2');
  });

  it('요청이 동시에 여러 개여도 갱신은 한 번만 한다(리프레시 토큰은 한 번만 쓸 수 있다)', async () => {
    vault.set(REFRESH_KEY, 'refresh-1');
    vault.set(EMAIL_KEY, user.email);
    const { session, apiRequest } = await setup();
    await session.restoreSession();
    apiRequest.mockImplementation(async (_method, path) => (path === '/auth/refresh' ? tokenOut(2) : { ok: true }));

    await Promise.all([session.authorizedRequest('GET', '/runs'), session.authorizedRequest('GET', '/me')]);

    expect(apiRequest.mock.calls.filter(([, path]) => path === '/auth/refresh')).toHaveLength(1);
  });

  it('401을 받으면 갱신하고 한 번 더 보낸다', async () => {
    const { session, apiRequest, ApiError } = await signedIn();
    apiRequest
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', '만료'))
      .mockResolvedValueOnce(tokenOut(2))
      .mockResolvedValueOnce({ ok: true });

    expect(await session.authorizedRequest('GET', '/runs')).toEqual({ ok: true });
    expect(apiRequest).toHaveBeenNthCalledWith(3, 'GET', '/runs', { body: undefined, accessToken: 'access-2' });
  });

  it('서버가 리프레시 토큰을 받지 않으면 만료로 바꾸고, 토큰은 지우되 이메일은 남긴다', async () => {
    const { session, apiRequest, useAuthStore, ApiError } = await signedIn();
    apiRequest
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', '만료'))
      .mockRejectedValueOnce(new ApiError(401, 'INVALID_REFRESH', '폐기됨'));

    await expect(session.authorizedRequest('GET', '/runs')).rejects.toBeInstanceOf(session.SessionExpiredError);

    expect(useAuthStore.getState()).toMatchObject({ status: 'expired', email: user.email });
    expect(vault.has(REFRESH_KEY)).toBe(false);
    expect(vault.get(EMAIL_KEY)).toBe(user.email);
  });

  it('갱신한 뒤에도 401이면 만료로 본다(끝없이 다시 보내지 않는다)', async () => {
    const { session, apiRequest, useAuthStore, ApiError } = await signedIn();
    apiRequest
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', '만료'))
      .mockResolvedValueOnce(tokenOut(2))
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', '만료'));

    await expect(session.authorizedRequest('GET', '/runs')).rejects.toBeInstanceOf(session.SessionExpiredError);
    expect(apiRequest).toHaveBeenCalledTimes(3);
    expect(useAuthStore.getState().status).toBe('expired');
  });

  it('갱신하다 서버에 닿지 못한 것은 만료가 아니다(로그인을 풀지 않는다)', async () => {
    vault.set(REFRESH_KEY, 'refresh-1');
    vault.set(EMAIL_KEY, user.email);
    const { session, apiRequest, useAuthStore, NetworkError } = await setup();
    await session.restoreSession();
    apiRequest.mockRejectedValueOnce(new NetworkError());

    await expect(session.authorizedRequest('GET', '/runs')).rejects.toBeInstanceOf(NetworkError);

    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(vault.get(REFRESH_KEY)).toBe('refresh-1');
  });

  it('토큰을 갱신하는 사이에 로그아웃하면, 늦게 온 새 토큰을 저장하지 않고 서버에 폐기를 알린다', async () => {
    vault.set(REFRESH_KEY, 'refresh-1');
    vault.set(EMAIL_KEY, user.email);
    const { session, apiRequest, useAuthStore } = await setup();
    await session.restoreSession();
    let finishRefresh: (tokens: unknown) => void = () => {};
    apiRequest.mockImplementation((_method, path) => {
      if (path === '/auth/refresh') return new Promise((resolve) => (finishRefresh = resolve)) as never;
      return Promise.resolve(undefined) as never;
    });

    const pending = session.authorizedRequest('GET', '/runs').catch((error: unknown) => error);
    await vi.waitFor(() => expect(apiRequest).toHaveBeenCalledWith('POST', '/auth/refresh', expect.anything()));
    await session.logOut();
    finishRefresh(tokenOut(2));

    expect(await pending).toBeInstanceOf(session.SessionExpiredError);
    // 로그아웃한 폰에 로그인이 되살아나지 않는다
    expect(vault.size).toBe(0);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', email: null });
    // 서버에 남은 새 토큰도 폐기를 알렸다
    expect(apiRequest).toHaveBeenCalledWith('POST', '/auth/logout', { body: { refresh_token: 'refresh-2' } });
  });

  it('토큰 갱신이 거절되는 사이에 로그아웃했으면 만료로 바꾸지 않는다', async () => {
    vault.set(REFRESH_KEY, 'refresh-1');
    vault.set(EMAIL_KEY, user.email);
    const { session, apiRequest, useAuthStore, ApiError } = await setup();
    await session.restoreSession();
    let failRefresh: (error: unknown) => void = () => {};
    apiRequest.mockImplementation((_method, path) => {
      if (path === '/auth/refresh') return new Promise((_resolve, reject) => (failRefresh = reject)) as never;
      return Promise.resolve(undefined) as never;
    });

    const pending = session.authorizedRequest('GET', '/runs').catch((error: unknown) => error);
    await vi.waitFor(() => expect(apiRequest).toHaveBeenCalledWith('POST', '/auth/refresh', expect.anything()));
    await session.logOut();
    failRefresh(new ApiError(401, 'INVALID_REFRESH', '폐기됨'));

    expect(await pending).toBeInstanceOf(session.SessionExpiredError);
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', email: null });
  });

  it('401이 아닌 거절은 그대로 올린다', async () => {
    const { session, apiRequest, useAuthStore, ApiError } = await signedIn();
    apiRequest.mockRejectedValueOnce(new ApiError(422, 'VALIDATION', '틀림'));
    await expect(session.authorizedRequest('PUT', '/runs/a', {})).rejects.toMatchObject({ status: 422 });
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('로그인돼 있지 않으면 서버에 보내지 않는다', async () => {
    const { session, apiRequest, useAuthStore } = await setup();
    useAuthStore.setState({ status: 'expired' });
    await expect(session.authorizedRequest('GET', '/runs')).rejects.toBeInstanceOf(session.SessionExpiredError);
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
