/** 로그인 · 회원가입 화면이 부르는 곳: 입력 확인 → 서버에 보내기 → 성공하면 기록 맞추기를 시작한다. */
import {
  authFailureErrors,
  hasErrors,
  normalizeEmail,
  validateAuthForm,
  type AuthFailure,
  type AuthForm,
  type AuthFormErrors,
  type AuthMode,
} from '@/domain/authForm';

import { ApiError, NetworkError } from './apiClient';
import { logIn, signUp } from './session';
import { syncNow } from './sync';

function toFailure(error: unknown): AuthFailure {
  if (error instanceof ApiError) {
    return { kind: 'api', status: error.status, code: error.code, message: error.message, fields: error.fields };
  }
  if (error instanceof NetworkError) return { kind: 'network' };
  return { kind: 'unknown' };
}

/**
 * 계정을 연결한다(로그인 또는 가입). 성공하면 null, 아니면 칸별 오류 문구를 돌려준다(던지지 않는다).
 * 성공하면 폰의 기록 올리기 + 서버 기록 내려받기를 시작해 두고 바로 돌아온다 — 진행은 동기화 상태 화면이 보여 준다.
 */
export async function connectAccount(mode: AuthMode, form: AuthForm): Promise<AuthFormErrors | null> {
  const errors = validateAuthForm(mode, form);
  if (hasErrors(errors)) return errors;
  try {
    const email = normalizeEmail(form.email);
    if (mode === 'login') await logIn(email, form.password);
    else await signUp(email, form.password);
  } catch (error) {
    // 비밀번호가 섞이지 않게 오류의 종류만 남긴다
    console.warn('[account] 계정을 연결하지 못했어요', error instanceof Error ? error.name : 'unknown');
    return authFailureErrors(toFailure(error));
  }
  void syncNow({ download: true });
  return null;
}
