import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiBaseUrl, apiRequest, NetworkError } from './apiClient';

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
  it('주소 앞부분과 JSON 본문 · 토큰을 붙여 보낸다', async () => {
    fetchMock.mockResolvedValue(respond(200, { ok: true }));

    const result = await apiRequest('PUT', '/runs/abc', { body: { mode: 'free' }, accessToken: 'token-1' });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${apiBaseUrl()}/runs/abc`);
    expect(url).toContain('/api/v1/runs/abc');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"mode":"free"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer token-1' });
  });

  it('본문 · 토큰이 없으면 그 머리글을 붙이지 않는다', async () => {
    fetchMock.mockResolvedValue(respond(200, {}));
    await apiRequest('GET', '/runs');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('환경변수의 서버 주소를 쓰고 끝의 빗금은 뺀다', () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.com/');
    expect(apiBaseUrl()).toBe('https://api.example.com/api/v1');
  });

  it('환경변수가 비어 있으면 기본 주소(에뮬레이터에서 본 내 PC)를 쓴다', () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', '');
    expect(apiBaseUrl()).toBe('http://10.0.2.2:8000/api/v1');
  });

  it('204는 본문 없이 성공이다', async () => {
    fetchMock.mockResolvedValue(respond(204));
    expect(await apiRequest('POST', '/auth/logout', { body: {} })).toBeUndefined();
  });
});

describe('서버가 거절했을 때', () => {
  it('에러 형식에서 코드 · 문구 · 칸별 오류를 꺼낸다', async () => {
    fetchMock.mockResolvedValue(
      respond(422, {
        detail: { code: 'VALIDATION', message: '입력한 값을 확인해 주세요', fields: [{ field: 'email', message: 'bad' }, { message: 'no field' }, 3] },
      }),
    );

    const error = await apiRequest('POST', '/auth/signup', { body: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION',
      message: '입력한 값을 확인해 주세요',
      fields: [
        { field: 'email', message: 'bad' },
        { field: '', message: 'no field' },
      ],
    });
  });

  it('형식이 다른 에러 응답(프록시의 HTML 등)은 상태 코드만으로 만든다', async () => {
    fetchMock.mockResolvedValue(respond(502));
    const error = await apiRequest('GET', '/runs').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'HTTP_ERROR', fields: [] });
  });

  it('성공인데 본문을 읽을 수 없으면 에러로 본다', async () => {
    fetchMock.mockResolvedValue(respond(200));
    await expect(apiRequest('GET', '/runs')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('서버에 닿지 못했을 때', () => {
  it('연결 실패는 NetworkError다(원인 문구를 그대로 올리지 않는다)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed: http://10.0.2.2:8000'));
    const error = (await apiRequest('GET', '/runs').catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).not.toContain('10.0.2.2');
  });

  it('정해진 시간 안에 답이 없으면 요청을 끊고 NetworkError다', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = apiRequest('GET', '/runs', { timeoutMs: 1000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);

    expect(await pending).toBeInstanceOf(NetworkError);
  });
});
