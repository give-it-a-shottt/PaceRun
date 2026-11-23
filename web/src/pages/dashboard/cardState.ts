/** 카드 하나가 그릴 값의 상태를 조회 결과에서 만든다. React를 쓰지 않는 함수만 둔다(테스트하기 쉽게). */
import { hasFailed } from '../../app/queryClient';

/** 카드 하나가 그릴 값의 상태: 읽는 중 · 실패 · 준비됨 */
export type CardState<T> = { status: 'loading' } | { status: 'failed'; retry: () => void } | { status: 'ready'; value: T };

/** 조회 하나에서 화면이 쓰는 것만: 값(아직 없으면 undefined), 보여 줄 값 없이 실패했는지, 다시 읽기 */
export type Loaded<T> = { data: T | undefined; failed: boolean; retry: () => void };

/** TanStack Query의 결과에서 Loaded를 만든다. 로그인이 풀린 실패는 실패로 치지 않는다(로그인 화면으로 간다). */
export function loadedOf<T>(query: { data: T | undefined; error: unknown; refetch: () => unknown }): Loaded<T> {
  return { data: query.data, failed: hasFailed(query), retry: () => void query.refetch() };
}

/** 값을 다른 모양으로 바꾼 Loaded(실패 · 다시 읽기는 그대로) */
export function mapLoaded<T, V>(source: Loaded<T>, map: (data: T) => V): Loaded<V> {
  return { ...source, data: source.data === undefined ? undefined : map(source.data) };
}

export function cardStateOf<T>(source: Loaded<T>): CardState<T> {
  if (source.data !== undefined) return { status: 'ready', value: source.data };
  if (source.failed) return { status: 'failed', retry: source.retry };
  return { status: 'loading' };
}

/**
 * 조회 두 개가 모두 있어야 그리는 카드의 상태.
 * 둘 다 있으면 준비됨, 하나라도 실패했으면 실패(다시 시도는 실패한 것만 다시 읽는다), 아니면 읽는 중.
 */
export function combineCardState<A, B, V>(
  first: Loaded<A>,
  second: Loaded<B>,
  build: (first: A, second: B) => V,
): CardState<V> {
  if (first.data !== undefined && second.data !== undefined) {
    return { status: 'ready', value: build(first.data, second.data) };
  }
  if (first.failed || second.failed) {
    return {
      status: 'failed',
      retry: () => {
        if (first.failed) first.retry();
        if (second.failed) second.retry();
      },
    };
  }
  return { status: 'loading' };
}
