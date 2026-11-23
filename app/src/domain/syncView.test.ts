import { describe, expect, it } from 'vitest';

import { describeAccount, loginIntro, SIGNED_OUT_BODY, type SyncInput } from './syncView';

const NOW = new Date(2026, 10, 23, 9, 0).getTime();

function input(overrides: Partial<SyncInput> = {}): SyncInput {
  return {
    status: 'signedOut',
    email: null,
    syncing: false,
    problem: null,
    localOnlyCount: 12,
    unsendableCount: 0,
    lastSyncAt: null,
    now: NOW,
    ...overrides,
  };
}

describe('로그인하지 않았을 때', () => {
  it('폰에만 있는 기록 수와 계정 연결 버튼을 보여 준다', () => {
    expect(describeAccount(input())).toEqual({
      headerTitle: '로그인 없이 사용 중',
      headerSubtitle: '기록 12개가 이 폰에만 저장돼 있어요',
      headerAction: { kind: 'connect', label: '계정 연결하고 웹에서 보기' },
      rowText: '연결 안 됨',
      statusTitle: '계정이 연결되지 않았어요',
      statusBody: SIGNED_OUT_BODY,
      lastSyncText: '–',
      localOnlyText: '12개',
      unsendableNote: null,
      problemNote: null,
      primaryAction: { kind: 'connect', label: '계정 연결' },
      busy: false,
      canLogOut: false,
    });
  });

  it('기록이 없거나 아직 세지 않았으면 수를 말하지 않는다', () => {
    expect(describeAccount(input({ localOnlyCount: 0 })).headerSubtitle).toBe('기록은 이 폰에 저장돼요');
    const unknown = describeAccount(input({ localOnlyCount: null }));
    expect(unknown.headerSubtitle).toBe('기록은 이 폰에 저장돼요');
    expect(unknown.localOnlyText).toBe('–');
  });

  it('저장된 로그인 정보를 읽는 동안에도 같은 모양이다', () => {
    expect(describeAccount(input({ status: 'loading' })).rowText).toBe('연결 안 됨');
  });
});

describe('로그인 화면의 안내', () => {
  it('올릴 기록이 있으면 그 수를 알린다', () => {
    expect(loginIntro(6)).toBe('웹 대시보드와 같은 계정이에요. 로그인하면 이 폰의 기록 6개가 함께 올라가요.');
  });

  it('올릴 기록이 없거나 아직 세지 않았으면 앞 문장만 보여 준다', () => {
    expect(loginIntro(0)).toBe('웹 대시보드와 같은 계정이에요.');
    expect(loginIntro(null)).toBe('웹 대시보드와 같은 계정이에요.');
  });
});

describe('로그인돼 있을 때', () => {
  const signedIn = (overrides: Partial<SyncInput> = {}) =>
    describeAccount(input({ status: 'signedIn', email: 'runner@example.com', localOnlyCount: 0, ...overrides }));

  it('모두 올라갔으면 그렇게 알리고 [지금 동기화]와 [로그아웃]을 둔다', () => {
    const view = signedIn({ lastSyncAt: new Date(2026, 10, 23, 7, 12).getTime() });
    expect(view).toMatchObject({
      headerTitle: 'runner@example.com',
      headerSubtitle: '모든 기록이 서버에 올라가 있어요',
      headerAction: null,
      rowText: '동기화됨',
      statusTitle: '계정이 연결돼 있어요',
      lastSyncText: '오늘 오전 7:12',
      localOnlyText: '0개',
      primaryAction: { kind: 'sync', label: '지금 동기화' },
      canLogOut: true,
      busy: false,
    });
    expect(view.statusBody).toContain('runner@example.com');
  });

  it('올릴 기록이 남아 있으면 수를 알린다', () => {
    const view = signedIn({ localOnlyCount: 2 });
    expect(view.headerSubtitle).toBe('올릴 기록 2개가 있어요');
    expect(view.rowText).toBe('올릴 기록 2개');
    expect(view.localOnlyText).toBe('2개');
  });

  it('동기화가 도는 동안에는 도는 중이라고 알린다', () => {
    const view = signedIn({ localOnlyCount: 2, syncing: true });
    expect(view.headerSubtitle).toBe('동기화하는 중이에요');
    expect(view.rowText).toBe('동기화 중');
    expect(view.busy).toBe(true);
  });

  it('서버가 받지 않는 기록은 올릴 기록으로 세지 않고 따로 알린다', () => {
    const view = signedIn({ localOnlyCount: 3, unsendableCount: 1 });
    expect(view.rowText).toBe('올릴 기록 2개');
    expect(view.localOnlyText).toBe('3개');
    expect(view.unsendableNote).toContain('1개');

    const onlyUnsendable = signedIn({ localOnlyCount: 1, unsendableCount: 1 });
    expect(onlyUnsendable.rowText).toBe('동기화됨');
    expect(onlyUnsendable.headerSubtitle).toBe('모든 기록이 서버에 올라가 있어요');
  });

  it('마지막 동기화가 실패한 까닭을 알린다', () => {
    expect(signedIn({ problem: 'offline' }).problemNote).toContain('연결하지 못했어요');
    expect(signedIn({ problem: 'server' }).problemNote).toContain('서버에 문제');
    expect(signedIn().problemNote).toBeNull();
  });

  it('마지막 동기화가 오늘이 아니면 날짜까지 적는다', () => {
    expect(signedIn({ lastSyncAt: new Date(2026, 10, 20, 19, 5).getTime() }).lastSyncText).toBe('11월 20일 (금) 오후 7:05');
  });
});

describe('로그인이 만료됐을 때', () => {
  it('다시 로그인하라고 알리고 올릴 기록은 남아 있다고 말한다', () => {
    const view = describeAccount(input({ status: 'expired', email: 'runner@example.com', localOnlyCount: 2, problem: 'expired', syncing: true }));
    expect(view).toMatchObject({
      headerTitle: 'runner@example.com',
      headerSubtitle: '다시 로그인이 필요해요',
      headerAction: { kind: 'relogin', label: '다시 로그인' },
      rowText: '다시 로그인 필요',
      statusTitle: '다시 로그인이 필요해요',
      localOnlyText: '2개',
      primaryAction: { kind: 'relogin', label: '다시 로그인' },
      problemNote: null,
      canLogOut: true,
      busy: false,
    });
    expect(view.statusBody).toContain('그대로');
  });

  it('이메일을 모르면 이메일 자리에 상태를 적는다', () => {
    expect(describeAccount(input({ status: 'expired' })).headerTitle).toBe('로그인 만료');
  });
});
