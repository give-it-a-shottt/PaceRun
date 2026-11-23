import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_MESSAGES } from '@/domain/authForm';

import { connectAccount } from './account';
import { ApiError, NetworkError } from './apiClient';
import { logIn, signUp } from './session';
import { syncNow } from './sync';

// 서버로 가는 길과 동기화를 가짜로 바꿔 "언제 보내고, 실패를 어떤 문구로 돌려주고, 성공하면 무엇을 시작하는지"를 본다.
vi.mock('./session', () => ({ logIn: vi.fn(), signUp: vi.fn() }));
vi.mock('./sync', () => ({ syncNow: vi.fn() }));

const GOOD = { email: ' runner@example.com ', password: 'password1', confirm: 'password1' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(syncNow).mockResolvedValue(undefined);
});

describe('계정 연결', () => {
  it('입력이 틀리면 서버에 보내지 않고 칸별 문구를 돌려준다', async () => {
    const errors = await connectAccount('signup', { email: 'x', password: '123', confirm: '123' });
    expect(errors).toEqual({ email: AUTH_MESSAGES.emailInvalid, password: AUTH_MESSAGES.passwordShort });
    expect(signUp).not.toHaveBeenCalled();
    expect(syncNow).not.toHaveBeenCalled();
  });

  it('로그인에 성공하면 null을 돌려주고, 올리기 + 내려받기를 시작한다', async () => {
    expect(await connectAccount('login', GOOD)).toBeNull();
    // 이메일은 앞뒤 공백을 빼고 보낸다
    expect(logIn).toHaveBeenCalledWith('runner@example.com', 'password1');
    expect(syncNow).toHaveBeenCalledWith({ download: true });
  });

  it('가입은 가입 요청을 보낸다', async () => {
    expect(await connectAccount('signup', GOOD)).toBeNull();
    expect(signUp).toHaveBeenCalledWith('runner@example.com', 'password1');
    expect(logIn).not.toHaveBeenCalled();
  });

  it('동기화가 끝나기를 기다리지 않는다(진행은 동기화 상태 화면이 보여 준다)', async () => {
    vi.mocked(syncNow).mockReturnValue(new Promise(() => {}));
    await expect(connectAccount('login', GOOD)).resolves.toBeNull();
  });

  it('서버의 거절을 문구로 바꿔 돌려주고 동기화는 시작하지 않는다', async () => {
    vi.mocked(logIn).mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', '틀림'));
    expect(await connectAccount('login', GOOD)).toEqual({ form: AUTH_MESSAGES.invalidCredentials });

    vi.mocked(signUp).mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', '이미 있음'));
    expect(await connectAccount('signup', GOOD)).toEqual({ email: AUTH_MESSAGES.emailTaken });

    expect(syncNow).not.toHaveBeenCalled();
  });

  it('서버에 닿지 못했거나 알 수 없는 오류도 던지지 않고 문구로 돌려준다', async () => {
    vi.mocked(logIn).mockRejectedValue(new NetworkError());
    expect(await connectAccount('login', GOOD)).toEqual({ form: AUTH_MESSAGES.offline });

    vi.mocked(logIn).mockRejectedValue(new Error('keystore'));
    expect(await connectAccount('login', GOOD)).toEqual({ form: AUTH_MESSAGES.unknown });
  });
});
