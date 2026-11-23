/** 던져진 오류를 "어떤 실패인가"로만 줄인다. 오류의 내용은 어디에도 찍지 않는다(입력값이 섞일 수 있다). */
import type { LoginFailure } from '../domain/loginForm';
import { ApiError, NetworkError } from './client';

/** 로그인 화면이 문구를 고르는 데 쓰는 모양 */
export function toLoginFailure(error: unknown): LoginFailure {
  if (error instanceof ApiError) return { kind: 'api', status: error.status, code: error.code };
  if (error instanceof NetworkError) return { kind: 'network' };
  return { kind: 'unknown' };
}
