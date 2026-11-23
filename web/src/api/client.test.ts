import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiBaseUrl, apiRequest, NetworkError } from './client';

const fetchMock = vi.fn();

function respond(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body');
      return body;
    },
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('요청 보내기', () => {
  it('주소를 주지 않으면 이 사이트와 같은 주소의 /api/v1로 보낸다', async () => {
    fetchMock.mockResolvedValue(respond(200, { ok: true }));

    await apiRequest('GET', '/stats?period=month', { accessToken: 'token-1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(apiBaseUrl()).toBe('/api/v1');
    expect(url).toBe('/api/v1/stats?period=month');
    expect(init.headers.Authorization).toBe('Bearer token-1');
    // 조회에는 쿠키를 싣지 않는다
    expect(init.credentials).toBe('omit');
    expect(init.headers).not.toHaveProperty('X-Refresh-Mode');
  });

  it('서버를 다른 주소에 뒀으면 그 주소로 보낸다(끝의 빗금은 뺀다)', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/');
    expect(apiBaseUrl()).toBe('https://api.example.com/api/v1');
  });

  it('쿠키 방식 요청은 쿠키를 싣고 머리글을 붙인다', async () => {
    fetchMock.mockResolvedValue(respond(204));

    expect(await apiRequest('POST', '/auth/logout', { cookieMode: true })).toBeUndefined();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect(init.headers['X-Refresh-Mode']).toBe('cookie');
    expect(init.body).toBeUndefined();
  });
});

describe('실패했을 때', () => {
  it('에러 형식에서 코드 · 문구를 꺼낸다', async () => {
    fetchMock.mockResolvedValue(respond(404, { detail: { code: 'RUN_NOT_FOUND', message: '기록을 찾지 못했어요' } }));
    const error = (await apiRequest('GET', '/runs/x').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'RUN_NOT_FOUND', message: '기록을 찾지 못했어요', fields: [] });
  });

  it('형식이 다른 에러 응답은 상태 코드만으로 만든다', async () => {
    fetchMock.mockResolvedValue(respond(502));
    await expect(apiRequest('GET', '/runs')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('성공인데 본문을 읽을 수 없으면 에러로 본다', async () => {
    fetchMock.mockResolvedValue(respond(200));
    await expect(apiRequest('GET', '/runs')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('서버에 닿지 못하면 NetworkError다', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiRequest('GET', '/runs')).rejects.toBeInstanceOf(NetworkError);
  });

  it('머리글은 왔는데 본문이 멈춰도 시간 제한에 걸리면 NetworkError다', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => ({
      status: 200,
      ok: true,
      json: () =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    }));

    const pending = apiRequest('GET', '/runs', { timeoutMs: 1000 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);

    expect(await pending).toBeInstanceOf(NetworkError);
  });
});
