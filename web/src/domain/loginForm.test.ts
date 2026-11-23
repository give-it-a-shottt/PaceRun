import { describe, expect, it } from 'vitest';

import { hasErrors, LOGIN_MESSAGES, loginFailureErrors, validateLogin } from './loginForm';

describe('보내기 전 확인', () => {
  it('맞는 입력이면 오류가 없다(앞뒤 공백은 괜찮다)', () => {
    expect(validateLogin({ email: ' runner@example.com ', password: 'x' })).toEqual({});
    expect(hasErrors({})).toBe(false);
  });

  it('이메일이 비었거나 모양이 틀리면 알려 준다', () => {
    expect(validateLogin({ email: '  ', password: 'x' })).toEqual({ email: LOGIN_MESSAGES.emailEmpty });
    for (const email of ['runner', 'runner@', '@example.com', 'runner@example', 'run ner@example.com']) {
      expect(validateLogin({ email, password: 'x' }).email).toBe(LOGIN_MESSAGES.emailInvalid);
    }
  });

  it('비밀번호가 비었으면 알려 준다(길이는 서버가 판단한다)', () => {
    expect(validateLogin({ email: 'runner@example.com', password: '' })).toEqual({ password: LOGIN_MESSAGES.passwordEmpty });
    const both = validateLogin({ email: '', password: '' });
    expect(both).toEqual({ email: LOGIN_MESSAGES.emailEmpty, password: LOGIN_MESSAGES.passwordEmpty });
    expect(hasErrors(both)).toBe(true);
  });
});

describe('실패를 문구로', () => {
  it('틀린 조합은 어느 쪽이 틀렸는지 밝히지 않는다', () => {
    expect(loginFailureErrors({ kind: 'api', status: 401, code: 'INVALID_CREDENTIALS' })).toEqual({
      form: LOGIN_MESSAGES.invalidCredentials,
    });
    // 서버가 입력의 모양을 받지 않은 경우(예: 비밀번호 73자)도 같은 문구다
    expect(loginFailureErrors({ kind: 'api', status: 422, code: 'VALIDATION' })).toEqual({
      form: LOGIN_MESSAGES.invalidCredentials,
    });
  });

  it('서버에 닿지 못했거나 알 수 없는 오류는 다시 시도하라고 알린다', () => {
    expect(loginFailureErrors({ kind: 'network' })).toEqual({ form: LOGIN_MESSAGES.offline });
    expect(loginFailureErrors({ kind: 'unknown' })).toEqual({ form: LOGIN_MESSAGES.unknown });
    expect(loginFailureErrors({ kind: 'api', status: 500, code: 'INTERNAL' })).toEqual({ form: LOGIN_MESSAGES.unknown });
  });
});
