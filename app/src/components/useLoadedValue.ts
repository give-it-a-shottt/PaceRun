import { useCallback, useEffect, useState } from 'react';

/** loading = 읽는 중 / ready = 값이 있음 / missing = 읽었는데 없음(null) / failed = 읽지 못함 */
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'missing' }
  | { status: 'failed' };

/**
 * 화면에 들어올 때 값 하나를 읽는다(러닝 상세 · 완료 요약). load가 바뀌면 다시 읽는다.
 * load는 바뀌지 않는 함수(useCallback)여야 한다. 읽는 도중 화면을 떠나거나 load가 바뀌면 늦게 온 결과는 버린다.
 */
export function useLoadedValue<T>(load: () => Promise<T | null>, logLabel: string): { state: Loaded<T>; retry: () => void } {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((value) => {
        if (!cancelled) setState(value == null ? { status: 'missing' } : { status: 'ready', value });
      })
      .catch((error) => {
        console.warn(`[${logLabel}] 기록을 읽지 못했어요`, error);
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [load, logLabel, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
