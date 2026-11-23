import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '../api/client';
import { SessionExpiredError } from '../api/session';

/** 서버에 닿지 못했거나 서버 쪽 오류(5xx)일 때 다시 해 보는 횟수 */
const MAX_RETRIES = 2;
/** 이 시간 안에는 같은 조회를 다시 보내지 않는다(탭을 오갈 때마다 다시 읽지 않게) */
const STALE_TIME_MS = 30_000;

const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

/** 다시 보내도 결과가 같을 실패(로그인이 풀림 · 4xx)는 다시 하지 않는다. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof SessionExpiredError) return false;
  if (error instanceof ApiError && error.status >= HTTP_CLIENT_ERROR_MIN && error.status < HTTP_SERVER_ERROR_MIN) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/** 화면에 "불러오지 못했어요"를 띄울 실패인가. 로그인이 풀린 것은 로그인 화면으로 가므로 띄우지 않는다. */
export function isShownFailure(error: unknown): boolean {
  return error != null && !(error instanceof SessionExpiredError);
}

/** 보여 줄 값 없이 실패한 조회인가(값이 있으면 다시 읽기가 실패해도 그 값을 계속 보여 준다). */
export function hasFailed(query: { data: unknown; error: unknown }): boolean {
  return query.data === undefined && isShownFailure(query.error);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: STALE_TIME_MS },
    },
  });
}
