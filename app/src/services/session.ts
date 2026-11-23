/**
 * 로그인 상태를 맡는다: 가입 · 로그인 · 로그아웃, 토큰 보관, 액세스 토큰 갱신(D-006).
 * 리프레시 토큰은 expo-secure-store에만 두고(SQLite · 로그 · 화면 상태에 두지 않는다), 액세스 토큰은 메모리에만 둔다.
 */
import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '@/state/authStore';

import { ApiError, apiRequest, badResponseError } from './apiClient';

const REFRESH_TOKEN_KEY = 'pacerun.refreshToken';
const EMAIL_KEY = 'pacerun.email';
/** 액세스 토큰이 이만큼보다 적게 남았으면 미리 새로 받는다(요청이 가는 도중에 만료되지 않게) */
const ACCESS_TOKEN_MARGIN_MS = 30_000;

type TokenOut = { access_token: string; refresh_token: string | null; expires_in: number };
type AuthOut = TokenOut & { user: { id: string; email: string; weekly_goal: number } };

/** 로그인이 만료됨(리프레시 토큰이 없거나 서버가 받지 않음). 다시 로그인해야 한다. */
export class SessionExpiredError extends Error {
  constructor() {
    super('다시 로그인이 필요해요');
    this.name = 'SessionExpiredError';
  }
}

let accessToken: { value: string; expiresAt: number } | null = null;
/**
 * 로그인 "판" 번호. 로그인 · 로그아웃할 때마다 올린다. 서버에 다녀오는 사이에 번호가 바뀌었으면
 * (그 사이 로그아웃했거나 다른 계정으로 로그인했으면) 늦게 온 결과로 토큰을 저장하거나 상태를 바꾸지 않는다.
 */
let sessionEpoch = 0;
/** 갱신은 한 번에 하나만. 리프레시 토큰은 한 번 쓰면 바뀌므로 겹쳐 보내면 한쪽이 401이 된다. */
let refreshing: Promise<string> | null = null;

function keepAccessToken(tokens: TokenOut): string {
  accessToken = { value: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  return tokens.access_token;
}

/** 앱을 켤 때 한 번: 저장해 둔 로그인 정보를 읽어 상태를 정한다. 서버에는 묻지 않는다(필요할 때 갱신한다). */
export async function restoreSession(): Promise<void> {
  try {
    const [refreshToken, email] = await Promise.all([
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.getItemAsync(EMAIL_KEY),
    ]);
    // 이메일만 남아 있으면 만료된 뒤 아직 다시 로그인하지 않은 것이다
    const status = refreshToken ? 'signedIn' : email ? 'expired' : 'signedOut';
    useAuthStore.setState({ status, email });
  } catch (error) {
    // 보관함을 읽지 못하면 로그인하지 않은 것으로 연다. 기록은 폰에 그대로 있고, 다시 로그인하면 된다.
    console.warn('[session] 저장된 로그인 정보를 읽지 못했어요', error);
    useAuthStore.setState({ status: 'signedOut', email: null });
  }
}

async function startSession(auth: AuthOut): Promise<void> {
  if (!auth.refresh_token) throw badResponseError();
  sessionEpoch += 1;
  // 리프레시 토큰을 먼저 저장한다. 저장에 실패하면 로그인된 것으로 치지 않는다.
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, auth.refresh_token);
  try {
    await SecureStore.setItemAsync(EMAIL_KEY, auth.user.email);
  } catch (error) {
    // 화면에는 실패로 알리는데 토큰만 남으면, 다음에 켰을 때 이메일 없는 로그인 상태가 된다. 넣은 토큰을 도로 지운다.
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
    throw error;
  }
  keepAccessToken(auth);
  useAuthStore.setState({ status: 'signedIn', email: auth.user.email, syncProblem: null });
}

/** 가입하고 바로 로그인된 상태가 된다. 실패하면 ApiError(409 EMAIL_TAKEN 등) · NetworkError를 던진다. */
export async function signUp(email: string, password: string): Promise<void> {
  await startSession(await apiRequest<AuthOut>('POST', '/auth/signup', { body: { email, password } }));
}

/** 실패하면 ApiError(401 INVALID_CREDENTIALS 등) · NetworkError를 던진다. */
export async function logIn(email: string, password: string): Promise<void> {
  await startSession(await apiRequest<AuthOut>('POST', '/auth/login', { body: { email, password } }));
}

/**
 * 로그아웃: 폰의 토큰을 지우고 서버에도 폐기를 알린다. 폰의 기록은 지우지 않는다.
 * 서버에 닿지 못해도 폰에서는 로그아웃된다(토큰은 30일 뒤 스스로 만료된다).
 */
export async function logOut(): Promise<void> {
  // 지금 돌고 있는 토큰 갱신이 끝나도 그 결과를 쓰지 않게 판 번호부터 올린다
  sessionEpoch += 1;
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
  accessToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(EMAIL_KEY).catch(() => undefined),
  ]);
  useAuthStore.setState({ status: 'signedOut', email: null, syncProblem: null, unsendableCount: 0 });
  if (refreshToken) {
    await apiRequest<void>('POST', '/auth/logout', { body: { refresh_token: refreshToken } }).catch(() => undefined);
  }
}

/**
 * 만료로 바꾼다: 쓸 수 없는 토큰을 지우고, 이메일은 남겨 다시 로그인 화면에 채워 준다.
 * 요청을 보낸 뒤로 로그인 판이 바뀌었으면(로그아웃 · 다시 로그인) 아무것도 하지 않는다.
 */
async function expireSession(epoch: number): Promise<void> {
  if (epoch !== sessionEpoch) return;
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
  if (epoch === sessionEpoch) useAuthStore.setState({ status: 'expired' });
}

/** 늦게 받은 토큰을 버린다: 보관함에 들어갔으면 지우고, 서버에도 폐기를 알린다(닿지 못하면 30일 뒤 스스로 만료된다). */
async function discardLateToken(refreshToken: string, stored: boolean): Promise<void> {
  if (stored && useAuthStore.getState().status !== 'signedIn') {
    // 그 사이 다시 로그인했다면 보관함에는 새 로그인의 토큰이 있다. 로그인돼 있지 않을 때만 지운다.
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
  }
  await apiRequest<void>('POST', '/auth/logout', { body: { refresh_token: refreshToken } }).catch(() => undefined);
}

async function refreshAccessToken(): Promise<string> {
  // 로그인돼 있지 않으면 갱신할 것이 없다. 상태는 건드리지 않는다(로그아웃한 것을 "만료"로 바꾸지 않게).
  if (useAuthStore.getState().status !== 'signedIn') throw new SessionExpiredError();
  const epoch = sessionEpoch;
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    await expireSession(epoch);
    throw new SessionExpiredError();
  }
  let tokens: TokenOut;
  try {
    tokens = await apiRequest<TokenOut>('POST', '/auth/refresh', { body: { refresh_token: refreshToken } });
  } catch (error) {
    // 서버가 토큰을 받지 않았을 때만 만료다. 서버에 닿지 못한 것(NetworkError)은 로그인을 풀 이유가 아니다.
    if (error instanceof ApiError && error.status === 401) {
      await expireSession(epoch);
      throw new SessionExpiredError();
    }
    throw error;
  }
  if (!tokens.refresh_token) throw badResponseError();
  if (epoch !== sessionEpoch) {
    // 서버에 다녀오는 사이에 로그아웃했다. 새로 받은 토큰을 저장하면 로그아웃한 폰에 로그인이 되살아난다.
    await discardLateToken(tokens.refresh_token, false);
    throw new SessionExpiredError();
  }
  // 쓴 토큰은 서버에서 이미 바뀌었다. 새 토큰을 저장하지 못하면 다음 갱신 때 만료로 드러난다.
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token);
  if (epoch !== sessionEpoch) {
    // 보관함에 넣는 사이에 로그아웃했다. 로그아웃의 지우기보다 이 쓰기가 늦게 닿았을 수 있으므로 다시 지운다.
    await discardLateToken(tokens.refresh_token, true);
    throw new SessionExpiredError();
  }
  return keepAccessToken(tokens);
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
 * 로그인이 필요한 요청. 액세스 토큰이 없거나 곧 만료되면 먼저 갱신하고, 그래도 401이면 한 번 더 갱신해 다시 보낸다.
 * 로그인이 만료됐으면 SessionExpiredError를 던진다.
 */
export async function authorizedRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (useAuthStore.getState().status !== 'signedIn') throw new SessionExpiredError();
  // 이 요청이 시작된 로그인 판. 답을 기다리는 사이에 로그아웃했으면 뒤늦은 401로 상태를 바꾸지 않는다.
  const epoch = sessionEpoch;
  const token = await freshAccessToken(false);
  try {
    return await apiRequest<T>(method, path, { body, accessToken: token });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
  if (epoch !== sessionEpoch) throw new SessionExpiredError();
  // 서버 시계와 어긋나 토큰이 먼저 만료된 경우. 새로 받아 한 번만 다시 보낸다.
  const retried = await freshAccessToken(true);
  try {
    return await apiRequest<T>(method, path, { body, accessToken: retried });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await expireSession(epoch);
      throw new SessionExpiredError();
    }
    throw error;
  }
}
