import { useCallback, useEffect, useState } from 'react';

/** loading = 읽는 중 / ready = 값이 있음 / missing = 읽었는데 없음(null) / failed = 읽지 못함 */
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'missing' }
  | { status: 'failed' };

const LOADING = { status: 'loading' } as const;

/**
 * 화면에 들어올 때 값 하나를 읽는다(러닝 상세 · 완료 요약). load가 바뀌거나 retry를 부르면 다시 읽는다.
 * load는 바뀌지 않는 함수(useCallback)여야 한다. 읽는 도중 화면을 떠나거나 load가 바뀌면 늦게 온 결과는 버린다.
 */
export function useLoadedValue<T>(load: () => Promise<T | null>, logLabel: string): { state: Loaded<T>; retry: () => void } {
  // 결과에 "어느 요청의 결과인지"를 함께 적어 둔다. 지금 요청(load · attempt)의 결과가 아니면 읽는 중으로 본다 —
  // load가 바뀐 직후에 이전 값이 잠깐 보이지 않게.
  const [result, setResult] = useState<{ load: typeof load; attempt: number; state: Loaded<T> } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((value): Loaded<T> => (value == null ? { status: 'missing' } : { status: 'ready', value }))
      .catch((error): Loaded<T> => {
        console.warn(`[${logLabel}] 기록을 읽지 못했어요`, error);
        return { status: 'failed' };
      })
      .then((state) => {
        if (!cancelled) setResult({ load, attempt, state });
      });
    return () => {
      cancelled = true;
    };
  }, [load, logLabel, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const current = result && result.load === load && result.attempt === attempt ? result.state : LOADING;
  return { state: current, retry };
}
