import { describe, expect, it } from 'vitest';

import { AUTH_MESSAGES, authFailureErrors, hasErrors, normalizeEmail, validateAuthForm } from './authForm';

const GOOD = { email: 'runner@example.com', password: 'password1', confirm: 'password1' };

describe('보내기 전 확인', () => {
  it('맞는 입력이면 오류가 없다', () => {
    expect(validateAuthForm('signup', GOOD)).toEqual({});
    expect(validateAuthForm('login', { email: GOOD.email, password: 'x' })).toEqual({});
    expect(hasErrors({})).toBe(false);
  });

  it('이메일이 비었거나 모양이 틀리면 알려 준다', () => {
    expect(validateAuthForm('login', { ...GOOD, email: '  ' }).email).toBe(AUTH_MESSAGES.emailEmpty);
    for (const email of ['runner', 'runner@', '@example.com', 'runner@example', 'run ner@example.com', `${'a'.repeat(250)}@b.co`]) {
      expect(validateAuthForm('login', { ...GOOD, email }).email).toBe(AUTH_MESSAGES.emailInvalid);
    }
  });

  it('앞뒤 공백은 이메일 오류가 아니다(보낼 때 뺀다)', () => {
    expect(validateAuthForm('login', { ...GOOD, email: ' runner@example.com ' })).toEqual({});
    expect(normalizeEmail(' runner@example.com ')).toBe('runner@example.com');
  });

  it('가입할 때 비밀번호는 8~72자여야 한다', () => {
    expect(validateAuthForm('signup', { ...GOOD, password: '', confirm: '' }).password).toBe(AUTH_MESSAGES.passwordEmpty);
    expect(validateAuthForm('signup', { ...GOOD, password: '1234567', confirm: '1234567' }).password).toBe(AUTH_MESSAGES.passwordShort);
    expect(validateAuthForm('signup', { ...GOOD, password: '12345678', confirm: '12345678' })).toEqual({});
    const long = 'a'.repeat(73);
    expect(validateAuthForm('signup', { ...GOOD, password: long, confirm: long }).password).toBe(AUTH_MESSAGES.passwordLong);
    expect(validateAuthForm('signup', { ...GOOD, password: 'a'.repeat(72), confirm: 'a'.repeat(72) })).toEqual({});
  });

  it('로그인은 비밀번호가 비었는지와 너무 긴지만 본다', () => {
    expect(validateAuthForm('login', { ...GOOD, password: '' }).password).toBe(AUTH_MESSAGES.passwordEmpty);
    expect(validateAuthForm('login', { ...GOOD, password: '123' })).toEqual({});
    expect(validateAuthForm('login', { ...GOOD, password: 'a'.repeat(73) }).password).toBe(AUTH_MESSAGES.passwordLong);
  });

  it('가입할 때 비밀번호 확인이 다르면 알려 준다(비밀번호 자체가 틀렸으면 그것부터)', () => {
    expect(validateAuthForm('signup', { ...GOOD, confirm: 'password2' })).toEqual({ confirm: AUTH_MESSAGES.confirmMismatch });
    expect(validateAuthForm('signup', { ...GOOD, confirm: undefined }).confirm).toBe(AUTH_MESSAGES.confirmMismatch);
    expect(validateAuthForm('signup', { ...GOOD, password: 'short', confirm: 'other' })).toEqual({
      password: AUTH_MESSAGES.passwordShort,
    });
    // 로그인에는 확인 칸이 없다
    expect(validateAuthForm('login', { ...GOOD, confirm: 'different' })).toEqual({});
  });

  it('여러 칸이 틀리면 칸마다 알려 준다', () => {
    const errors = validateAuthForm('signup', { email: 'x', password: '1', confirm: '' });
    expect(errors).toEqual({ email: AUTH_MESSAGES.emailInvalid, password: AUTH_MESSAGES.passwordShort });
    expect(hasErrors(errors)).toBe(true);
  });
});

describe('서버의 거절을 문구로', () => {
  const api = (status: number, code: string, fields: { field: string; message: string }[] = [], message = '입력한 값을 확인해 주세요') =>
    ({ kind: 'api', status, code, message, fields }) as const;

  it('이미 가입한 이메일은 이메일 칸에 알린다', () => {
    expect(authFailureErrors(api(409, 'EMAIL_TAKEN'))).toEqual({ email: AUTH_MESSAGES.emailTaken });
  });

  it('이메일 · 비밀번호가 틀리면 어느 쪽인지 밝히지 않는다', () => {
    expect(authFailureErrors(api(401, 'INVALID_CREDENTIALS'))).toEqual({ form: AUTH_MESSAGES.invalidCredentials });
  });

  it('입력 오류(422)는 어느 칸인지만 쓰고 서버의 영어 문장은 보여 주지 않는다', () => {
    const errors = authFailureErrors(
      api(422, 'VALIDATION', [
        { field: 'email', message: 'value is not a valid email address' },
        { field: 'password', message: 'String should have at least 8 characters' },
      ]),
    );
    expect(errors).toEqual({ email: AUTH_MESSAGES.emailInvalid, password: AUTH_MESSAGES.passwordInvalid });
  });

  it('어느 칸인지 알 수 없는 입력 오류는 서버의 한 줄 문구를 보여 준다', () => {
    expect(authFailureErrors(api(422, 'VALIDATION'))).toEqual({ form: '입력한 값을 확인해 주세요' });
    expect(authFailureErrors(api(422, 'VALIDATION', [{ field: '', message: 'x' }], ''))).toEqual({ form: AUTH_MESSAGES.unknown });
  });

  it('서버에 닿지 못했거나 알 수 없는 오류는 다시 시도하라고 알린다', () => {
    expect(authFailureErrors({ kind: 'network' })).toEqual({ form: AUTH_MESSAGES.offline });
    expect(authFailureErrors({ kind: 'unknown' })).toEqual({ form: AUTH_MESSAGES.unknown });
    expect(authFailureErrors(api(500, 'INTERNAL'))).toEqual({ form: AUTH_MESSAGES.unknown });
  });
});
