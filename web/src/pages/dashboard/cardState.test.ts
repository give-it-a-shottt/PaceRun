import { describe, expect, it } from 'vitest';

import { NetworkError } from '../../api/client';
import { SessionExpiredError } from '../../api/session';
import { cardStateOf, combineCardState, loadedOf, mapLoaded, type Loaded } from './cardState';

/** 다시 읽기를 몇 번 불렀는지 세는 Loaded */
function source<T>(data: T | undefined, failed = false): Loaded<T> & { retried: () => number } {
  let count = 0;
  return {
    data,
    failed,
    retry: () => {
      count += 1;
    },
    retried: () => count,
  };
}

describe('loadedOf', () => {
  it('값이 없고 오류가 있으면 실패다', () => {
    expect(loadedOf({ data: undefined, error: new NetworkError(), refetch: () => undefined }).failed).toBe(true);
  });

  it('값이 있으면 다시 읽기가 실패해도 실패로 치지 않는다', () => {
    const loaded = loadedOf({ data: 1, error: new NetworkError(), refetch: () => undefined });
    expect(loaded).toMatchObject({ data: 1, failed: false });
  });

  it('로그인이 풀린 실패는 실패로 치지 않는다', () => {
    expect(loadedOf({ data: undefined, error: new SessionExpiredError(), refetch: () => undefined }).failed).toBe(false);
  });

  it('다시 읽기는 조회의 refetch를 부른다', () => {
    let refetched = 0;
    loadedOf({ data: undefined, error: null, refetch: () => (refetched += 1) }).retry();
    expect(refetched).toBe(1);
  });
});

describe('mapLoaded', () => {
  it('값이 있으면 바꾸고, 없으면 그대로 둔다', () => {
    expect(mapLoaded(source(2), (n) => n * 10).data).toBe(20);
    expect(mapLoaded(source<number>(undefined, true), (n) => n * 10)).toMatchObject({ data: undefined, failed: true });
  });
});

describe('cardStateOf', () => {
  it('값이 있으면 준비됨', () => {
    expect(cardStateOf(source('값'))).toEqual({ status: 'ready', value: '값' });
  });

  it('값 없이 실패했으면 실패이고, 다시 시도가 그 조회를 다시 읽는다', () => {
    const failed = source<string>(undefined, true);
    const state = cardStateOf(failed);
    expect(state.status).toBe('failed');
    if (state.status === 'failed') state.retry();
    expect(failed.retried()).toBe(1);
  });

  it('값도 실패도 없으면 읽는 중', () => {
    expect(cardStateOf(source<string>(undefined))).toEqual({ status: 'loading' });
  });
});

describe('combineCardState', () => {
  const join = (a: string, b: number) => `${a}${b}`;

  it('둘 다 있으면 준비됨', () => {
    expect(combineCardState(source('주'), source(3), join)).toEqual({ status: 'ready', value: '주3' });
  });

  it('하나를 아직 읽는 중이면 읽는 중', () => {
    expect(combineCardState(source('주'), source<number>(undefined), join)).toEqual({ status: 'loading' });
    expect(combineCardState(source<string>(undefined), source<number>(undefined), join)).toEqual({ status: 'loading' });
  });

  it('하나가 실패했으면 실패이고, 다시 시도는 실패한 것만 다시 읽는다', () => {
    const ok = source('주');
    const failed = source<number>(undefined, true);
    const state = combineCardState(ok, failed, join);
    expect(state.status).toBe('failed');
    if (state.status === 'failed') state.retry();
    expect(ok.retried()).toBe(0);
    expect(failed.retried()).toBe(1);
  });

  it('하나는 실패하고 하나는 읽는 중이어도 실패를 먼저 알린다', () => {
    const failed = source<string>(undefined, true);
    const pending = source<number>(undefined);
    const state = combineCardState(failed, pending, join);
    expect(state.status).toBe('failed');
    if (state.status === 'failed') state.retry();
    expect(failed.retried()).toBe(1);
    expect(pending.retried()).toBe(0);
  });

  it('둘 다 실패했으면 둘 다 다시 읽는다', () => {
    const first = source<string>(undefined, true);
    const second = source<number>(undefined, true);
    const state = combineCardState(first, second, join);
    if (state.status === 'failed') state.retry();
    expect(first.retried()).toBe(1);
    expect(second.retried()).toBe(1);
  });
});
