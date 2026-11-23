/** 화면 표시와 음성 문장에 쓰는 숫자 표현. 앱 전체가 이 함수들만 써서 표기를 하나로 맞춘다. */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 경과 시간 "5:42", 1시간 이상이면 "1:02:03" */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
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

/** 목표 거리 표기 "3km", "2.5km" (소수는 한 자리까지) */
export function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`;
}

/** 음성용 시간: 90초 → "1분 30초", 60초 → "1분", 45초 → "45초" */
export function speakDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

/** 음성용 페이스: 368초 → "6분 8초" */
export function speakPace(secPerKm: number): string {
  return speakDuration(secPerKm);
}

/** 음성용 거리: 1000 → "1킬로미터", 1500 → "1.5킬로미터" */
export function speakDistanceKm(meters: number): string {
  const km = Math.round(meters / 100) / 10;
  return `${Number.isInteger(km) ? km : km.toFixed(1)}킬로미터`;
}

/** JS의 getDay() 순서(0 = 일요일) */
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'];
const NOON_HOUR = 12;

function meridiem(date: Date): string {
  return date.getHours() < NOON_HOUR ? '오전' : '오후';
}

/** 12시간제 시 · 분 "7:12"(0시와 12시는 12로) */
function clockDigits(date: Date): string {
  const hour = date.getHours() % NOON_HOUR === 0 ? NOON_HOUR : date.getHours() % NOON_HOUR;
  return `${hour}:${pad2(date.getMinutes())}`;
}

/** 시각 "오전 7:12", "오후 9:40" */
export function formatClock(time: number): string {
  const date = new Date(time);
  return `${meridiem(date)} ${clockDigits(date)}`;
}

/** 날짜 "11월 20일" */
export function formatMonthDay(time: number): string {
  const date = new Date(time);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 날짜와 시각 "11월 20일 (목) 오전 7:12" */
export function formatDateTime(time: number): string {
  return `${formatMonthDay(time)} (${WEEKDAY_SHORT[new Date(time).getDay()]}) ${formatClock(time)}`;
}

/**
 * 시작 ~ 끝 "11월 20일 (목) 오전 7:12 – 7:32". 끝이 같은 오전/오후면 되풀이하지 않고,
 * 바뀌면 붙인다("오전 11:50 – 오후 12:20").
 */
export function formatTimeRange(start: number, end: number): string {
  const from = new Date(start);
  const to = new Date(end);
  const endText = meridiem(from) === meridiem(to) ? clockDigits(to) : formatClock(end);
  return `${formatDateTime(start)} – ${endText}`;
}
