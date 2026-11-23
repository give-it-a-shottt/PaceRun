/**
 * 웹의 로그인 상태(D-006): 액세스 토큰은 메모리에만 두고, 리프레시 토큰은 서버가 주는 httpOnly 쿠키로만 다닌다
 * (자바스크립트가 읽을 수 없다 — localStorage · sessionStorage에 토큰을 두지 않는다).
 * 새로 고침하면 메모리가 비므로, 켤 때 쿠키로 액세스 토큰을 다시 받는다.
 */
import type { User } from '../domain/types';
import { ApiError, apiRequest } from './client';

/** loading = 쿠키로 다시 로그인해 보는 중 / signedOut = 로그인 안 됨 / signedIn = 로그인됨 */
export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: User };

type TokenOut = { access_token: string; expires_in: number };
type AuthOut = TokenOut & { user: User };

/** 액세스 토큰이 이만큼보다 적게 남았으면 미리 새로 받는다 */
const ACCESS_TOKEN_MARGIN_MS = 30_000;

let state: SessionState = { status: 'loading', user: null };
const listeners = new Set<() => void>();
let accessToken: { value: string; expiresAt: number } | null = null;
/** 갱신은 한 번에 하나만. 리프레시 토큰은 한 번 쓰면 바뀌므로 겹쳐 보내면 한쪽이 401이 된다. */
let refreshing: Promise<string> | null = null;
let restoring: Promise<void> | null = null;

function setState(next: SessionState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** React의 useSyncExternalStore에 넘기는 한 쌍 */
export function getSessionState(): SessionState {
  return state;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function keepAccessToken(tokens: TokenOut): string {
  accessToken = { value: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  return tokens.access_token;
}

function signOutLocally(): void {
  accessToken = null;
  setState({ status: 'signedOut', user: null });
}

/** 로그인이 풀림(쿠키가 없거나 서버가 받지 않음). 화면은 로그인 화면으로 보낸다. */
export class SessionExpiredError extends Error {
  constructor() {
    super('다시 로그인이 필요해요');
    this.name = 'SessionExpiredError';
  }
}

async function refreshAccessToken(): Promise<string> {
  try {
    return keepAccessToken(await apiRequest<TokenOut>('POST', '/auth/refresh', { cookieMode: true }));
  } catch (error) {
    // 서버가 쿠키를 받지 않았을 때만 로그인이 풀린 것이다. 서버에 닿지 못한 것은 그대로 올린다.
    if (error instanceof ApiError && error.status === 401) {
      signOutLocally();
      throw new SessionExpiredError();
    }
    throw error;
  }
}

function freshAccessToken(force: boolean): Promise<string> {
  if (!force && accessToken && accessToken.expiresAt - Date.now() > ACCESS_TOKEN_MARGIN_MS) {
    return Promise.resolve(accessToken.value);
  }
  if (!refreshing) {
    refreshing = refreshAccessToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * 사이트를 열 때 한 번: 쿠키로 액세스 토큰을 받아 보고, 되면 내 정보를 읽어 로그인된 상태로 만든다.
 * 안 되면(쿠키 없음 · 만료 · 서버에 닿지 못함) 로그인 안 된 상태로 연다. 던지지 않는다.
 */
export function restoreSession(): Promise<void> {
  if (!restoring) {
    restoring = (async () => {
      try {
        const token = await freshAccessToken(true);
        const user = await apiRequest<User>('GET', '/me', { accessToken: token });
        setState({ status: 'signedIn', user });
      } catch {
        signOutLocally();
      }
    })();
  }
  return restoring;
}

/** 실패하면 ApiError(401 INVALID_CREDENTIALS 등) · NetworkError를 던진다. */
export async function logIn(email: string, password: string): Promise<void> {
  const auth = await apiRequest<AuthOut>('POST', '/auth/login', { body: { email, password }, cookieMode: true });
  keepAccessToken(auth);
  setState({ status: 'signedIn', user: auth.user });
}

/** 서버에 닿지 못해도 이 브라우저에서는 로그아웃된다(쿠키는 남을 수 있다 — 다음에 열면 다시 로그인된다). */
export async function logOut(): Promise<void> {
  await apiRequest<void>('POST', '/auth/logout', { cookieMode: true }).catch(() => undefined);
  signOutLocally();
}

/**
 * 로그인이 필요한 조회. 액세스 토큰이 없거나 곧 만료되면 먼저 갱신하고, 그래도 401이면 한 번 더 갱신해 다시 보낸다.
 * 로그인이 풀렸으면 SessionExpiredError를 던진다(상태도 signedOut으로 바뀐다).
 */
export async function authorizedGet<T>(path: string): Promise<T> {
  const token = await freshAccessToken(false);
  try {
    return await apiRequest<T>('GET', path, { accessToken: token });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
  const retried = await freshAccessToken(true);
  try {
    return await apiRequest<T>('GET', path, { accessToken: retried });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      signOutLocally();
      throw new SessionExpiredError();
    }
    throw error;
  }
}

/** 테스트용: 모듈이 기억하는 값을 처음으로 되돌린다. */
export function resetSessionForTest(): void {
  state = { status: 'loading', user: null };
  accessToken = null;
  refreshing = null;
  restoring = null;
  listeners.clear();
}
