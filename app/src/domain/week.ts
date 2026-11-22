/**
 * 주 계산. 한 주는 월요일 0시에 시작한다(폰의 시간대 기준).
 * 날짜 더하기는 밀리초가 아니라 달력으로 한다 — 서머타임이 있는 곳에서는 하루가 23 · 25시간일 수 있다.
 */

export const DAYS_PER_WEEK = 7;

/** 요일 번호 0=월 … 6=일 순서의 이름. `plan_items.weekday`와 같은 번호다. */
export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
export const WEEKDAY_NAMES = WEEKDAY_LABELS.map((label) => `${label}요일`);

/** 0=월 … 6=일 */
export function weekdayIndex(time: number): number {
  // JS의 getDay()는 0=일 … 6=토
  return (new Date(time).getDay() + 6) % DAYS_PER_WEEK;
}

/** 그날 0시 */
export function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 날짜를 days만큼 옮긴다(시각은 그대로). */
export function addDays(time: number, days: number): number {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** 그 주 월요일 0시 */
export function startOfWeek(time: number): number {
  return addDays(startOfDay(time), -weekdayIndex(time));
}

/** 같은 날인가 */
export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/**
 * "11월 4주차". 주가 두 달에 걸치면 목요일이 속한 달의 주로 센다
 * (그 주의 날이 더 많이 들어 있는 달. 달력 앱들이 흔히 쓰는 기준).
 */
export function weekLabel(time: number): string {
  const thursday = new Date(addDays(startOfWeek(time), 3));
  const nth = Math.ceil(thursday.getDate() / DAYS_PER_WEEK);
  return `${thursday.getMonth() + 1}월 ${nth}주차`;
}

/** 지금부터 다음 날 0시까지 남은 시간(밀리초). 화면을 켜 둔 채 날짜가 바뀌는 순간을 맞추는 데 쓴다. */
export function msUntilNextDay(now: number): number {
  return addDays(startOfDay(now), 1) - now;
}

/** 그 주의 날짜 범위 "11월 17일 – 23일". 주가 두 달에 걸치면 "11월 30일 – 12월 6일" */
export function weekRangeText(time: number): string {
  const first = new Date(startOfWeek(time));
  const last = new Date(addDays(first.getTime(), DAYS_PER_WEEK - 1));
  const end = first.getMonth() === last.getMonth() ? `${last.getDate()}일` : `${last.getMonth() + 1}월 ${last.getDate()}일`;
  return `${first.getMonth() + 1}월 ${first.getDate()}일 – ${end}`;
}
