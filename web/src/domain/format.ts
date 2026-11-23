/** 화면에 쓰는 숫자 · 날짜 표현. 웹 전체가 이 함수들만 써서 표기를 하나로 맞춘다(앱과 같은 표기). */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 경과 시간 "5:42", 1시간 이상이면 "1:02:03" */
export function formatDuration(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** 합계 시간 "4시간 12분", "35분" */
export function formatHoursMinutes(seconds: number): string {
  const totalMin = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 페이스 `6'08"`. 값이 없으면 `-'--"` */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return `-'--"`;
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}'${pad2(total % 60)}"`;
}

/** 거리 "0.93"(km, 소수 둘째 자리까지 버림 — 뛴 것보다 많이 보이지 않게) */
export function formatDistanceKm(meters: number): string {
  return (Math.floor(Math.max(0, meters) / 10) / 100).toFixed(2);
}

/** 합계 거리 "32.4"(km, 소수 한 자리) */
export function formatKmOneDecimal(meters: number): string {
  return (Math.max(0, meters) / 1000).toFixed(1);
}

/** 목표 거리 "3km", "2.5km" */
export function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`;
}

/** 초를 말로: 8 → "8초", 60 → "1분", 273 → "4분 33초" (페이스 차이 · 목표 시간에 쓴다) */
export function formatSecondsText(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}초`;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}

/** JS의 getDay() 순서(0 = 일요일) */
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'];
const NOON_HOUR = 12;

function clock12(date: Date): string {
  const meridiem = date.getHours() < NOON_HOUR ? '오전' : '오후';
  const hour = date.getHours() % NOON_HOUR === 0 ? NOON_HOUR : date.getHours() % NOON_HOUR;
  return `${meridiem} ${hour}:${pad2(date.getMinutes())}`;
}

function monthDayWeekday(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_SHORT[date.getDay()]})`;
}

/** 목록의 날짜 "11월 20일 (목) 07:12" (24시간제 — 표에서 줄을 맞추려고) */
export function formatListDateTime(iso: string): string {
  const date = new Date(iso);
  return `${monthDayWeekday(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 날짜 "11월 20일" (ISO 문자열 또는 epoch 밀리초) */
export function formatMonthDay(time: string | number): string {
  const date = new Date(time);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 상세의 시각 범위 "2026년 11월 20일 (목) 오전 7:12 – 7:32". 오전/오후가 바뀌거나 날이 넘어가면 끝에도 적는다. */
export function formatDateTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const head = `${start.getFullYear()}년 ${monthDayWeekday(start)} ${clock12(start)}`;
  const sameDay = start.toDateString() === end.toDateString();
  const sameHalf = start.getHours() < NOON_HOUR === end.getHours() < NOON_HOUR;
  if (!sameDay) return `${head} – ${monthDayWeekday(end)} ${clock12(end)}`;
  return `${head} – ${sameHalf ? clock12(end).split(' ')[1] : clock12(end)}`;
}
