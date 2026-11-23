/** 서버 API에 요청을 보내는 가장 아래 층. 주소 · 에러 형식 · 시간 제한만 다룬다(토큰은 session.ts가 붙인다). */

import { isRecord } from '@/domain/guards';

/** 개발 중 에뮬레이터에서 내 PC의 서버를 가리키는 주소. 실기기 · 운영에서는 EXPO_PUBLIC_API_URL로 바꾼다. */
const DEFAULT_API_ORIGIN = 'http://10.0.2.2:8000';
const API_PREFIX = '/api/v1';
/** 이 시간 안에 답이 없으면 서버에 닿지 못한 것으로 본다 */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * 요청을 보낼 주소. 보낼 수 없으면 null:
 * 개발 빌드가 아닌데(스토어에 올리는 빌드) 주소를 주지 않았거나 주소가 https가 아닐 때 —
 * 비밀번호와 토큰을 암호화 없이 보내거나, 개발용 기본 주소로 보내는 일을 막는다.
 */
export function apiBaseUrl(isDevBuild: boolean = process.env.NODE_ENV !== 'production'): string | null {
  // 비어 있는 값(.env에 이름만 적어 둔 경우)도 주지 않은 것으로 본다
  const configured = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
  if (!isDevBuild) return configured.startsWith('https://') ? configured + API_PREFIX : null;
  return (configured || DEFAULT_API_ORIGIN) + API_PREFIX;
}

export type FieldError = { field: string; message: string };

/** 서버가 에러 형식(`{detail: {code, message, fields?}}`)으로 거절한 요청 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 성공 응답인데 약속한 모양이 아닐 때(본문이 없음 · 꼭 있어야 할 칸이 없음). 서버 문제로 다룬다. */
export function badResponseError(status = 200): ApiError {
  return new ApiError(status, 'BAD_RESPONSE', '서버의 응답을 읽지 못했어요');
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
  timeoutMs?: number;
};

/** 에러 응답의 본문에서 코드 · 문구 · 칸별 오류를 꺼낸다. 형식이 다르면(프록시의 HTML 등) 상태 코드만으로 만든다. */
function toApiError(status: number, payload: unknown): ApiError {
  const detail = isRecord(payload) && isRecord(payload.detail) ? payload.detail : null;
  const code = typeof detail?.code === 'string' ? detail.code : 'HTTP_ERROR';
  const message = typeof detail?.message === 'string' ? detail.message : '요청을 처리하지 못했어요';
  const fields = Array.isArray(detail?.fields)
    ? detail.fields.flatMap((item): FieldError[] =>
        isRecord(item) && typeof item.message === 'string'
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
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new NetworkError('서버 주소가 설정되지 않았어요');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  // 시간 제한은 본문을 다 읽을 때까지 건다(머리글만 오고 본문이 멈추는 경우에도 끝없이 기다리지 않게).
  try {
    let response: Response;
    try {
      response = await fetch(baseUrl + path, {
        method,
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? null : { 'Content-Type': 'application/json' }),
          ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : null),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      // fetch는 연결 실패 · 시간 초과(abort)를 모두 예외로 알린다. 원인 문구에는 주소가 들어 있어 그대로 올리지 않는다.
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
    if (payload === null) throw badResponseError(response.status);
    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}
