/** 로그인 입력을 보내기 전에 확인하고, 실패를 화면에 보여 줄 문구로 바꾼다. */

/** 모양만 본다(글자@글자.글자) */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LoginForm = { email: string; password: string };
/** 칸마다의 오류 문구. form은 어느 칸의 것도 아닌 오류(틀린 조합 · 연결 실패) */
export type LoginErrors = { email?: string; password?: string; form?: string };

export const LOGIN_MESSAGES = {
  emailEmpty: '이메일을 입력해 주세요',
  emailInvalid: '이메일 주소를 확인해 주세요',
  passwordEmpty: '비밀번호를 입력해 주세요',
  invalidCredentials: '이메일 또는 비밀번호가 맞지 않아요',
  offline: '서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요',
  unknown: '로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요',
} as const;

export function hasErrors(errors: LoginErrors): boolean {
  return Object.values(errors).some((message) => message != null);
}

/** 보내기 전에 확인한다. 오류가 없으면 빈 객체. 비밀번호 길이는 서버가 판단한다(비어 있는지만 본다). */
export function validateLogin(form: LoginForm): LoginErrors {
  const errors: LoginErrors = {};
  const email = form.email.trim();
  if (email.length === 0) errors.email = LOGIN_MESSAGES.emailEmpty;
  else if (!EMAIL_PATTERN.test(email)) errors.email = LOGIN_MESSAGES.emailInvalid;
  if (form.password.length === 0) errors.password = LOGIN_MESSAGES.passwordEmpty;
  return errors;
}

/** 실패의 종류(화면이 오류 객체를 이 모양으로 바꿔 넘긴다) */
export type LoginFailure = { kind: 'api'; status: number; code: string } | { kind: 'network' } | { kind: 'unknown' };

export function loginFailureErrors(failure: LoginFailure): LoginErrors {
  if (failure.kind === 'network') return { form: LOGIN_MESSAGES.offline };
  if (failure.kind === 'unknown') return { form: LOGIN_MESSAGES.unknown };
  // 틀린 조합과, 서버가 모양을 받지 않은 경우(422) 모두 "맞지 않아요"로 알린다 — 어느 쪽이 틀렸는지 밝히지 않는다
  if (failure.code === 'INVALID_CREDENTIALS' || failure.status === 422) return { form: LOGIN_MESSAGES.invalidCredentials };
  return { form: LOGIN_MESSAGES.unknown };
}
