import { describe, expect, it } from 'vitest';

import {
  formatReminderClock,
  formatReminderHour,
  formatReminderMinute,
  parseReminderTime,
  stepHour,
  stepMinute,
  toReminderTime,
} from './reminderTime';

describe('toReminderTime', () => {
  it('설정에 저장하는 "HH:mm" 모양으로 만든다', () => {
    expect(toReminderTime({ hour: 7, minute: 0 })).toBe('07:00');
    expect(toReminderTime({ hour: 19, minute: 30 })).toBe('19:30');
    expect(toReminderTime({ hour: 0, minute: 0 })).toBe('00:00');
  });
});

describe('formatReminderClock', () => {
  it('오전 · 오후와 12시간 표기로 보여 준다', () => {
    expect(formatReminderClock({ hour: 7, minute: 0 })).toBe('오전 7:00');
    expect(formatReminderClock({ hour: 19, minute: 30 })).toBe('오후 7:30');
  });

  it('0시는 오전 12시, 12시는 오후 12시로 보여 준다', () => {
    expect(formatReminderClock({ hour: 0, minute: 10 })).toBe('오전 12:10');
    expect(formatReminderClock({ hour: 12, minute: 0 })).toBe('오후 12:00');
  });
});

describe('formatReminderHour · formatReminderMinute', () => {
  it('시 · 분 칸의 글자를 만든다', () => {
    expect(formatReminderHour(7)).toBe('오전 7시');
    expect(formatReminderHour(0)).toBe('오전 12시');
    expect(formatReminderHour(23)).toBe('오후 11시');
    expect(formatReminderMinute(0)).toBe('00분');
    expect(formatReminderMinute(50)).toBe('50분');
  });
});

describe('stepHour', () => {
  it('한 시간씩 옮기고 분은 그대로 둔다', () => {
    expect(stepHour({ hour: 7, minute: 30 }, 1)).toEqual({ hour: 8, minute: 30 });
    expect(stepHour({ hour: 7, minute: 30 }, -1)).toEqual({ hour: 6, minute: 30 });
  });

  it('하루의 끝에서 반대쪽으로 돈다', () => {
    expect(stepHour({ hour: 23, minute: 0 }, 1)).toEqual({ hour: 0, minute: 0 });
    expect(stepHour({ hour: 0, minute: 0 }, -1)).toEqual({ hour: 23, minute: 0 });
  });
});

describe('stepMinute', () => {
  it('10분씩 옮기고 시는 그대로 둔다', () => {
    expect(stepMinute({ hour: 7, minute: 0 }, 1)).toEqual({ hour: 7, minute: 10 });
    expect(stepMinute({ hour: 7, minute: 30 }, -1)).toEqual({ hour: 7, minute: 20 });
  });

  it('한 시간의 끝에서 반대쪽으로 돌고 시는 바꾸지 않는다', () => {
    expect(stepMinute({ hour: 7, minute: 50 }, 1)).toEqual({ hour: 7, minute: 0 });
    expect(stepMinute({ hour: 7, minute: 0 }, -1)).toEqual({ hour: 7, minute: 50 });
  });

  it('10분 단위가 아닌 값은 가까운 10분 단위로 맞춘다', () => {
    expect(stepMinute({ hour: 7, minute: 35 }, 1)).toEqual({ hour: 7, minute: 40 });
    expect(stepMinute({ hour: 7, minute: 35 }, -1)).toEqual({ hour: 7, minute: 30 });
    expect(stepMinute({ hour: 7, minute: 55 }, 1)).toEqual({ hour: 7, minute: 0 });
  });
});

describe('parseReminderTime', () => {
  it('저장된 "HH:mm"을 시 · 분으로 읽는다', () => {
    expect(parseReminderTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseReminderTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('알림을 꺼 둔 값(null)과 모양이 틀린 값은 null이다', () => {
    for (const bad of [null, '', '7:30', '24:00', '07:60', '07-30', ' 07:30', '07:30:00', 'abc']) {
      expect(parseReminderTime(bad)).toBeNull();
    }
  });

  it('저장한 모양을 다시 읽으면 같은 시각이 된다', () => {
    const clock = { hour: 19, minute: 40 };
    expect(parseReminderTime(toReminderTime(clock))).toEqual(clock);
  });
});
