/** 서버 API에 요청을 보내는 가장 아래 층. 주소 · 에러 형식 · 시간 제한만 다룬다(토큰은 session.ts가 붙인다). */

const API_PREFIX = '/api/v1';
/** 이 시간 안에 답이 없으면 서버에 닿지 못한 것으로 본다 */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * 비워 두면 이 사이트와 같은 주소로 보낸다(개발 중에는 vite가 /api를 내 PC의 서버로 넘겨 준다 — vite.config.ts).
 * 서버를 다른 주소에 둘 때만 VITE_API_URL을 준다.
 */
export function apiBaseUrl(): string {
  const origin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  return origin + API_PREFIX;
}

export type FieldError = { field: string; message: string };

/** 서버가 에러 형식(`{detail: {code, message, fields?}}`)으로 거절한 요청 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldError[];

  constructor(status: number, code: string, message: string, fields: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// 웹이 뜻을 두고 보는 HTTP 상태들. 판정은 아래 함수들만 쓴다(숫자를 파일마다 적지 않는다).
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
const HTTP_SERVER_ERROR_MIN = 500;

/** 로그인이 필요하다 · 토큰을 받지 않는다(401) */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === HTTP_UNAUTHORIZED;
}

/** 요청이 틀렸다는 답(4xx). 다시 보내도 결과가 같다 */
export function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= HTTP_CLIENT_ERROR_MIN && error.status < HTTP_SERVER_ERROR_MIN;
}

/** 서버 쪽 오류(5xx) */
export function isServerError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= HTTP_SERVER_ERROR_MIN;
}

/**
 * "그런 기록이 없다"는 답인가. 서버는 없는 번호에 404를, 번호의 모양이 틀리면(UUID가 아님) 422를 준다 —
 * 둘 다 주소가 가리키는 기록이 없는 것이다.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === HTTP_NOT_FOUND || error.status === HTTP_UNPROCESSABLE);
}

/** 서버에 닿지 못함(인터넷 없음 · 서버 꺼짐 · 시간 초과). 나중에 다시 시도하면 될 수 있다. */
export class NetworkError extends Error {
  constructor(message = '서버에 연결하지 못했어요') {
    super(message);
    this.name = 'NetworkError';
  }
}

type RequestOptions = {
  body?: unknown;
  accessToken?: string;
  /** 리프레시 토큰을 쿠키로 주고받는 요청(로그인 · 갱신 · 로그아웃)에 붙인다 — D-006 */
  cookieMode?: boolean;
  timeoutMs?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 에러 응답의 본문에서 코드 · 문구 · 칸별 오류를 꺼낸다. 형식이 다르면(프록시의 HTML 등) 상태 코드만으로 만든다. */
function toApiError(status: number, payload: unknown): ApiError {
  const detail = isObject(payload) && isObject(payload.detail) ? payload.detail : null;
  const code = typeof detail?.code === 'string' ? detail.code : 'HTTP_ERROR';
  const message = typeof detail?.message === 'string' ? detail.message : '요청을 처리하지 못했어요';
  const fields = Array.isArray(detail?.fields)
    ? detail.fields.flatMap((item): FieldError[] =>
        isObject(item) && typeof item.message === 'string'
          ? [{ field: typeof item.field === 'string' ? item.field : '', message: item.message }]
          : [],
      )
    : [];
  return new ApiError(status, code, message, fields);
}

/**
 * 요청을 보내고 JSON 응답을 돌려준다(204면 undefined).
 * 서버가 거절하면 ApiError, 서버에 닿지 못하면 NetworkError를 던진다.
 */
export async function apiRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  if (options.cookieMode) headers['X-Refresh-Mode'] = 'cookie';

  // 시간 제한은 본문을 다 읽을 때까지 건다(머리글만 오고 본문이 멈추는 경우에도 끝없이 기다리지 않게).
  try {
    let response: Response;
    try {
      response = await fetch(apiBaseUrl() + path, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        // 리프레시 토큰 쿠키(httpOnly)를 싣고 받는다. 그 밖의 요청에는 쿠키를 보내지 않는다.
        credentials: options.cookieMode ? 'include' : 'omit',
        signal: controller.signal,
      });
    } catch {
      throw new NetworkError();
    }

    if (response.status === 204) return undefined as T;

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // 본문을 읽다가 시간 제한에 걸렸으면 서버에 닿지 못한 것과 같다
      if (controller.signal.aborted) throw new NetworkError();
      // 그 밖에는 본문이 JSON이 아닌 것이다(프록시의 오류 페이지 등). 성공 응답이었다면 약속과 다른 것이므로 에러로 본다.
    }
    if (!response.ok) throw toApiError(response.status, payload);
    if (payload === null) throw new ApiError(response.status, 'BAD_RESPONSE', '서버의 응답을 읽지 못했어요');
    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}
