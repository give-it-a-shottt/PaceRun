import { describe, expect, it } from 'vitest';

import { addDays, isSameDay, startOfDay, startOfWeek, weekdayIndex } from './week';
import { countedInWeek, weekCells, weekProgress } from './weekProgress';

// 서머타임이 있는 시간대에서도 주 · 날짜 계산이 맞는지 본다.
// 이 파일만 시간대를 뉴욕으로 바꿔 돈다(테스트 파일마다 프로세스가 따로라 다른 테스트에 영향이 없다).
// 2026년 뉴욕: 3월 8일(일) 새벽에 1시간이 사라지고(하루 23시간), 11월 1일(일) 새벽에 1시간이 되풀이된다(하루 25시간).
process.env.TZ = 'America/New_York';

const HOUR = 3_600_000;
const local = (month: number, day: number, hour = 0, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();
const counted = (startedAt: number) => ({ startedAt, counted: true });

describe('서머타임 시간대', () => {
  it('테스트가 정말 서머타임 시간대에서 돌고 있다', () => {
    // 3월 8일은 23시간, 11월 1일은 25시간
    expect(local(3, 9) - local(3, 8)).toBe(23 * HOUR);
    expect(local(11, 2) - local(11, 1)).toBe(25 * HOUR);
  });

  it('날짜를 하루 옮기면 하루가 23 · 25시간이어도 다음 날 0시가 된다', () => {
    expect(addDays(local(3, 8), 1)).toBe(local(3, 9));
    expect(addDays(local(11, 1), 1)).toBe(local(11, 2));
    expect(addDays(local(3, 2), 7)).toBe(local(3, 9));
  });

  it('한 주의 시작은 서머타임이 바뀌는 주에도 월요일 0시다', () => {
    // 3월 2일(월) ~ 8일(일)
    expect(startOfWeek(local(3, 8, 12))).toBe(local(3, 2));
    expect(startOfWeek(local(3, 8, 23, 59))).toBe(local(3, 2));
    expect(startOfWeek(local(3, 9, 0, 30))).toBe(local(3, 9));
    // 10월 26일(월) ~ 11월 1일(일)
    expect(startOfWeek(local(11, 1, 23, 59))).toBe(local(10, 26));
    expect(startOfWeek(local(11, 2))).toBe(local(11, 2));
  });

  it('시간이 사라지거나 되풀이되는 날에도 요일과 "같은 날" 판단이 맞다', () => {
    expect(weekdayIndex(local(3, 8, 3))).toBe(6);
    expect(isSameDay(local(3, 8, 0, 30), local(3, 8, 23, 30))).toBe(true);
    expect(isSameDay(local(11, 1, 0, 30), local(11, 1, 23, 30))).toBe(true);
    expect(isSameDay(local(11, 1, 23, 30), local(11, 2, 0, 30))).toBe(false);
    expect(startOfDay(local(11, 1, 23, 30))).toBe(local(11, 1));
  });

  it('일요일 밤의 러닝은 그 주에, 월요일 0시 30분의 러닝은 다음 주에 들어간다', () => {
    const runs = [counted(local(3, 8, 23, 30)), counted(local(3, 9, 0, 30))];
    expect(countedInWeek(runs, local(3, 2))).toBe(1);
    expect(countedInWeek(runs, local(3, 9))).toBe(1);

    const fall = [counted(local(11, 1, 23, 30)), counted(local(11, 2, 0, 30))];
    expect(countedInWeek(fall, local(10, 26))).toBe(1);
    expect(countedInWeek(fall, local(11, 2))).toBe(1);
  });

  it('주간 칸은 25시간짜리 일요일의 러닝을 일요일 칸에 칠한다', () => {
    const cells = weekCells([counted(local(11, 1, 23, 30))], new Set(), local(11, 1, 23, 45));
    expect(cells.map((cell) => cell.state)).toEqual(['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'done']);
  });

  it('주 연속은 서머타임이 바뀐 주를 건너서도 이어서 센다', () => {
    // 2월 23일 주, 3월 2일 주(서머타임 시작), 3월 9일 주에 2번씩
    const runs = [
      counted(local(2, 23, 7)), counted(local(2, 25, 7)),
      counted(local(3, 2, 7)), counted(local(3, 8, 7)),
      counted(local(3, 9, 7)), counted(local(3, 14, 7)),
    ];
    expect(weekProgress(runs, 2, local(3, 18, 9))).toMatchObject({ previousStreak: 3, count: 0 });
  });
});
