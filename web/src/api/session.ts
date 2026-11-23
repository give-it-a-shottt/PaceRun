/**
 * 웹의 로그인 상태(D-006): 액세스 토큰은 메모리에만 두고, 리프레시 토큰은 서버가 주는 httpOnly 쿠키로만 다닌다
 * (자바스크립트가 읽을 수 없다 — localStorage · sessionStorage에 토큰을 두지 않는다).
 * 새로 고침하면 메모리가 비므로, 켤 때 쿠키로 액세스 토큰을 다시 받는다.
 */
import type { User } from '../domain/types';
import { ApiError, apiRequest, isServerError, isUnauthorized } from './client';

/**
 * loading = 쿠키로 다시 로그인해 보는 중 / signedOut = 로그인 안 됨 / signedIn = 로그인됨 /
 * unreachable = 사이트를 열 때 서버에 닿지 못해 로그인 여부를 모름(로그인 화면으로 보내지 않고 다시 시도하게 한다)
 */
export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'unreachable'; user: null }
  | { status: 'signedIn'; user: User };

type TokenOut = { access_token: string; expires_in: number };
type AuthOut = TokenOut & { user: User };

/** 액세스 토큰이 이만큼보다 적게 남았으면 미리 새로 받는다 */
const ACCESS_TOKEN_MARGIN_MS = 30_000;
/**
 * 쿠키 갱신이 401이면 이만큼 기다렸다가 한 번 더 해 본다. 탭 두 개가 동시에 갱신하면 늦은 쪽은 "방금 쓴 쿠키"라
 * 401을 받는데(서버는 이때 쿠키를 지우지 않는다), 잠깐 뒤에는 먼저 끝난 탭이 받은 새 쿠키가 실린다.
 */
const REFRESH_RETRY_DELAY_MS = 300;

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

function requestRefresh(): Promise<TokenOut> {
  return apiRequest<TokenOut>('POST', '/auth/refresh', { cookieMode: true });
}

async function refreshAccessToken(): Promise<string> {
  try {
    let tokens: TokenOut;
    try {
      tokens = await requestRefresh();
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      // 다른 탭이 방금 같은 쿠키로 갱신했을 수 있다. 잠깐 뒤에 한 번만 더 해 본다.
      await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
      tokens = await requestRefresh();
    }
    return keepAccessToken(tokens);
  } catch (error) {
    // 서버가 쿠키를 받지 않았을 때만 로그인이 풀린 것이다. 서버에 닿지 못한 것은 그대로 올린다.
    if (isUnauthorized(error)) {
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

/** 서버에 닿지 못했거나 서버 쪽 오류인가(쿠키가 살아 있을 수 있어 로그인이 풀렸다고 볼 수 없다) */
function isServerTrouble(error: unknown): boolean {
  if (error instanceof ApiError) return isServerError(error);
  return !(error instanceof SessionExpiredError);
}

/**
 * 사이트를 열 때 한 번: 쿠키로 액세스 토큰을 받아 보고, 되면 내 정보를 읽어 로그인된 상태로 만든다.
 * 쿠키가 없거나 만료됐으면 로그인 안 된 상태로, 서버에 닿지 못했으면 unreachable로 연다(쿠키가 살아 있는 사람에게
 * 비밀번호를 다시 치게 하지 않으려고 — 화면이 [다시 시도]를 보여 준다). 던지지 않는다.
 */
export function restoreSession(): Promise<void> {
  if (!restoring) {
    restoring = (async () => {
      try {
        const token = await freshAccessToken(true);
        const user = await apiRequest<User>('GET', '/me', { accessToken: token });
        setState({ status: 'signedIn', user });
      } catch (error) {
        accessToken = null;
        setState(isServerTrouble(error) ? { status: 'unreachable', user: null } : { status: 'signedOut', user: null });
      }
    })();
  }
  return restoring;
}

/** unreachable에서 [다시 시도]: 읽는 중으로 되돌리고 한 번 더 해 본다. */
export function retryRestoreSession(): Promise<void> {
  restoring = null;
  setState({ status: 'loading', user: null });
  return restoreSession();
}

/** 실패하면 ApiError(401 INVALID_CREDENTIALS 등) · NetworkError를 던진다. */
export async function logIn(email: string, password: string): Promise<void> {
  const auth = await apiRequest<AuthOut>('POST', '/auth/login', { body: { email, password }, cookieMode: true });
  keepAccessToken(auth);
  setState({ status: 'signedIn', user: auth.user });
}

/**
 * 로그아웃했으면 true. 서버에 닿지 못했으면 false이고 로그인된 채로 둔다 —
 * 리프레시 쿠키(httpOnly)는 서버만 지울 수 있어서, 지우지 못한 채 "로그아웃됨"으로 보여 주면
 * 다음에 사이트를 열 때 다시 로그인된다(함께 쓰는 PC에서 위험하다). 화면이 실패를 알린다.
 */
export async function logOut(): Promise<boolean> {
  try {
    await apiRequest<void>('POST', '/auth/logout', { cookieMode: true });
  } catch (error) {
    if (isServerTrouble(error)) return false;
    // 서버가 요청을 거절한 것(4xx)은 쿠키가 이미 쓸모없다는 뜻이다. 이 브라우저에서는 로그아웃으로 본다.
  }
  signOutLocally();
  return true;
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
    if (!isUnauthorized(error)) throw error;
  }
  const retried = await freshAccessToken(true);
  try {
    return await apiRequest<T>('GET', path, { accessToken: retried });
  } catch (error) {
    if (isUnauthorized(error)) {
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
