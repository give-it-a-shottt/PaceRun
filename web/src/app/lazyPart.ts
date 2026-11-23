/**
 * 따로 불러오는 화면 조각(차트 · 지도). 조각을 받지 못한 것과 그리다 난 예외를 구분하고, 받지 못했으면 다시 받을 수 있게 한다.
 * 조각을 받지 못한 것은 다시 받아 보면 될 수 있고, 그리다 난 예외는 다시 그려도 같다 — 오류 경계가 다르게 안내한다.
 * (React.lazy는 실패를 기억해서 다시 받을 수 없다. 그래서 받는 중인 약속을 여기서 들고 있다가 retry 때 버린다.)
 */
import { createElement, use, type ComponentType } from 'react';

/** 조각 파일을 받지 못함(연결 끊김 · 새 배포로 파일이 바뀜) */
export class PartLoadError extends Error {
  constructor() {
    super('화면 조각을 불러오지 못했어요');
    this.name = 'PartLoadError';
  }
}

export type PartLoader<T> = {
  /** 조각을 받는 약속. 한 번 받기 시작하면 retry 전까지 같은 약속을 준다. 받지 못하면 PartLoadError로 거절된다. */
  read: () => Promise<T>;
  /** 받아 둔 것(또는 실패)을 버린다. 다음 read가 다시 받아 온다. */
  retry: () => void;
};

export function createPartLoader<T>(load: () => Promise<T>): PartLoader<T> {
  let pending: Promise<T> | null = null;
  return {
    read: () => {
      pending ??= load().catch(() => {
        throw new PartLoadError();
      });
      return pending;
    },
    retry: () => {
      pending = null;
    },
  };
}

export type LazyPart<P> = {
  /** 조각을 그리는 컴포넌트. `<Suspense>`와 오류 경계 안에서 그린다. */
  Part: ComponentType<P>;
  /** 오류 경계의 onRetryPart에 넘긴다 */
  retry: () => void;
};

/** 파일 맨 위에서 한 번 만든다: `const { Part: Chart, retry } = createLazyPart(() => import('./Chart'))` */
export function createLazyPart<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): LazyPart<P> {
  const loader = createPartLoader(load);
  function Part(props: P) {
    // 받는 동안은 가까운 <Suspense>가, 받지 못하면 가까운 오류 경계가 대신 그린다
    return createElement(use(loader.read()).default, props);
  }
  return { Part, retry: loader.retry };
}
