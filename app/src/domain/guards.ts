/** 밖에서 들어온 값(서버 응답 · 저장돼 있던 JSON)의 모양을 확인할 때 쓰는 작은 함수들. */

/** 칸을 꺼내 볼 수 있는 객체인가(null · 배열이 아닌 객체) */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** NaN · 무한대가 아닌 숫자인가 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
