/** 로그인 · 회원가입 입력을 보내기 전에 확인하고, 서버의 거절을 화면에 보여 줄 문구로 바꾼다. */

// 서버가 받는 비밀번호 길이(overview/api-list.md "인증")
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
const EMAIL_MAX_LENGTH = 254;
/** 모양만 본다(글자@글자.글자). 실제로 있는 주소인지는 서버도 확인하지 않는다. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthMode = 'login' | 'signup';

export type AuthForm = {
  email: string;
  password: string;
  /** 비밀번호 확인(회원가입만) */
  confirm?: string;
};

/** 칸마다의 오류 문구. form은 어느 칸의 것도 아닌 오류(틀린 조합 · 연결 실패) */
export type AuthFormErrors = { email?: string; password?: string; confirm?: string; form?: string };

export const AUTH_MESSAGES = {
  emailEmpty: '이메일을 입력해 주세요',
  emailInvalid: '이메일 주소를 확인해 주세요',
  passwordEmpty: '비밀번호를 입력해 주세요',
  passwordShort: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 해요`,
  passwordLong: `비밀번호는 ${PASSWORD_MAX_LENGTH}자까지 쓸 수 있어요`,
  passwordInvalid: `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 써 주세요`,
  confirmMismatch: '비밀번호가 서로 달라요',
  emailTaken: '이미 가입한 이메일이에요. 로그인해 주세요',
  invalidCredentials: '이메일 또는 비밀번호가 맞지 않아요',
  offline: '서버에 연결하지 못했어요. 인터넷을 확인하고 다시 시도해 주세요',
  unknown: '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요',
} as const;

/** 서버에 보내는 이메일: 앞뒤 공백만 뺀다(대소문자는 서버가 맞춘다) */
export function normalizeEmail(email: string): string {
  return email.trim();
}

export function hasErrors(errors: AuthFormErrors): boolean {
  return Object.values(errors).some((message) => message != null);
}

function emailError(email: string): string | undefined {
  const trimmed = normalizeEmail(email);
  if (trimmed.length === 0) return AUTH_MESSAGES.emailEmpty;
  if (trimmed.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(trimmed)) return AUTH_MESSAGES.emailInvalid;
  return undefined;
}

/**
 * 보내기 전에 확인한다. 오류가 없으면 빈 객체.
 * 로그인은 비밀번호 길이를 따지지 않는다(예전 규칙으로 만든 비밀번호도 서버가 판단하게) — 비어 있는지만 본다.
 */
export function validateAuthForm(mode: AuthMode, form: AuthForm): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = emailError(form.email);
  if (email) errors.email = email;

  if (form.password.length === 0) errors.password = AUTH_MESSAGES.passwordEmpty;
  else if (mode === 'signup' && form.password.length < PASSWORD_MIN_LENGTH) errors.password = AUTH_MESSAGES.passwordShort;
  else if (form.password.length > PASSWORD_MAX_LENGTH) errors.password = AUTH_MESSAGES.passwordLong;

  if (mode === 'signup' && !errors.password && form.password !== (form.confirm ?? '')) {
    errors.confirm = AUTH_MESSAGES.confirmMismatch;
  }
  return errors;
}

/** 서버가 거절했거나 서버에 닿지 못한 결과(서비스가 오류를 이 모양으로 바꿔 넘긴다) */
export type AuthFailure =
  | { kind: 'api'; status: number; code: string; message: string; fields: readonly { field: string; message: string }[] }
  | { kind: 'network' }
  | { kind: 'unknown' };

/** 서버의 거절을 칸별 문구로 바꾼다. 어느 칸인지 알 수 없으면 form에 담는다. */
export function authFailureErrors(failure: AuthFailure): AuthFormErrors {
  if (failure.kind === 'network') return { form: AUTH_MESSAGES.offline };
  if (failure.kind === 'unknown') return { form: AUTH_MESSAGES.unknown };

  if (failure.code === 'EMAIL_TAKEN') return { email: AUTH_MESSAGES.emailTaken };
  if (failure.code === 'INVALID_CREDENTIALS') return { form: AUTH_MESSAGES.invalidCredentials };
  if (failure.status === 422) {
    const errors: AuthFormErrors = {};
    // 칸별 문구(fields[].message)는 서버 라이브러리가 만든 영어 문장이라 쓰지 않고, 어느 칸인지만 본다.
    for (const { field } of failure.fields) {
      if (field === 'email') errors.email = AUTH_MESSAGES.emailInvalid;
      else if (field === 'password') errors.password = AUTH_MESSAGES.passwordInvalid;
    }
    // 어느 칸인지 알 수 없으면 서버의 한 줄 문구("입력한 값을 확인해 주세요")를 보여 준다
    return hasErrors(errors) ? errors : { form: failure.message || AUTH_MESSAGES.unknown };
  }
  return { form: AUTH_MESSAGES.unknown };
}
