import { describe, expect, it } from 'vitest';

import { LOGIN_MESSAGES, loginFailureErrors } from '../domain/loginForm';
import { ApiError, NetworkError } from './client';
import { toLoginFailure } from './failures';

describe('로그인 실패를 문구용 모양으로', () => {
  it('서버의 거절은 상태와 코드만 남긴다', () => {
    expect(toLoginFailure(new ApiError(401, 'INVALID_CREDENTIALS', '틀림'))).toEqual({
      kind: 'api',
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('서버에 닿지 못한 것과 그 밖의 오류를 나눈다', () => {
    expect(toLoginFailure(new NetworkError())).toEqual({ kind: 'network' });
    expect(toLoginFailure(new TypeError('boom'))).toEqual({ kind: 'unknown' });
    expect(toLoginFailure(null)).toEqual({ kind: 'unknown' });
  });

  it('던져진 오류에서 화면 문구까지 이어진다', () => {
    expect(loginFailureErrors(toLoginFailure(new ApiError(401, 'INVALID_CREDENTIALS', '틀림')))).toEqual({
      form: LOGIN_MESSAGES.invalidCredentials,
    });
    expect(loginFailureErrors(toLoginFailure(new NetworkError()))).toEqual({ form: LOGIN_MESSAGES.offline });
  });
});
