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
