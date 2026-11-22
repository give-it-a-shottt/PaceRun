/** 알림 시각을 다루는 순수 함수. 저장 모양("HH:mm")과 화면 표기("오전 7:00")를 여기서만 만든다. */

export type ReminderClock = { hour: number; minute: number };

/** 피그마(ONB_01_003)에 보이는 기본 시각 */
export const DEFAULT_REMINDER_CLOCK: ReminderClock = { hour: 7, minute: 0 };

export const REMINDER_MINUTE_STEP = 10;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function meridiem(hour: number): string {
  return hour < 12 ? '오전' : '오후';
}

function hour12(hour: number): number {
  return hour % 12 === 0 ? 12 : hour % 12;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 설정에 저장된 모양을 읽는다: "07:30" → { hour: 7, minute: 30 }. 모양이 틀리거나 null이면 null */
export function parseReminderTime(time: string | null): ReminderClock | null {
  const match = time ? TIME_PATTERN.exec(time) : null;
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

/** 설정에 저장하는 모양: { 7, 0 } → "07:00" */
export function toReminderTime(clock: ReminderClock): string {
  return `${pad2(clock.hour)}:${pad2(clock.minute)}`;
}

/** 화면 표기: { 7, 0 } → "오전 7:00", { 19, 30 } → "오후 7:30" */
export function formatReminderClock(clock: ReminderClock): string {
  return `${meridiem(clock.hour)} ${hour12(clock.hour)}:${pad2(clock.minute)}`;
}

/** 시 칸 표기: 7 → "오전 7시", 0 → "오전 12시" */
export function formatReminderHour(hour: number): string {
  return `${meridiem(hour)} ${hour12(hour)}시`;
}

/** 분 칸 표기: 0 → "00분" */
export function formatReminderMinute(minute: number): string {
  return `${pad2(minute)}분`;
}

/** 시를 한 칸 옮긴다. 23시 다음은 0시로 돈다. */
export function stepHour(clock: ReminderClock, direction: 1 | -1): ReminderClock {
  return { ...clock, hour: (clock.hour + direction + HOURS_PER_DAY) % HOURS_PER_DAY };
}

/**
 * 분을 10분 단위로 옮긴다. 50분 다음은 00분으로 돌고, 시는 건드리지 않는다.
 * 10분 단위가 아닌 값(예: 35분)은 가까운 10분 단위로 먼저 맞춘다(+ → 40분, − → 30분).
 */
export function stepMinute(clock: ReminderClock, direction: 1 | -1): ReminderClock {
  const snapped =
    direction === 1
      ? Math.floor(clock.minute / REMINDER_MINUTE_STEP) * REMINDER_MINUTE_STEP
      : Math.ceil(clock.minute / REMINDER_MINUTE_STEP) * REMINDER_MINUTE_STEP;
  const next = snapped + direction * REMINDER_MINUTE_STEP;
  return { ...clock, minute: (next + MINUTES_PER_HOUR) % MINUTES_PER_HOUR };
}
