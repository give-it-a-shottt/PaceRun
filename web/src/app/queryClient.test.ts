import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from '../api/client';
import { SessionExpiredError } from '../api/session';
import { isShownFailure, shouldRetry } from './queryClient';

describe('shouldRetry', () => {
  it('로그인이 풀린 실패는 다시 하지 않는다', () => {
    expect(shouldRetry(0, new SessionExpiredError())).toBe(false);
  });

  it('4xx는 다시 하지 않는다', () => {
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', '없음'))).toBe(false);
    expect(shouldRetry(0, new ApiError(422, 'VALIDATION', '모양'))).toBe(false);
  });

  it('5xx와 연결 실패는 두 번까지 다시 한다', () => {
    expect(shouldRetry(0, new ApiError(500, 'HTTP_ERROR', '서버'))).toBe(true);
    expect(shouldRetry(1, new NetworkError())).toBe(true);
    expect(shouldRetry(2, new NetworkError())).toBe(false);
  });
});

describe('isShownFailure', () => {
  it('로그인이 풀린 것은 실패 문구를 띄우지 않는다', () => {
    expect(isShownFailure(new SessionExpiredError())).toBe(false);
    expect(isShownFailure(null)).toBe(false);
  });

  it('그 밖의 실패는 띄운다', () => {
    expect(isShownFailure(new NetworkError())).toBe(true);
    expect(isShownFailure(new ApiError(500, 'HTTP_ERROR', '서버'))).toBe(true);
  });
});
