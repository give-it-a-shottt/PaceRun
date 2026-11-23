import { describe, expect, it } from 'vitest';

import { describeGoalWeeks, SHOWN_WEEKS, startOfWeek, streakWindowStart, STREAK_LOOKBACK_WEEKS } from './weeks';

// 2026-11-23은 월요일이다
const MONDAY = new Date(2026, 10, 23, 9, 0).getTime();
const THURSDAY = new Date(2026, 10, 26, 9, 0).getTime();

/** 그 주(0 = 이번 주, 1 = 지난주 …)의 수요일 아침에 뛴 러닝 n개 */
function runsInWeek(weeksAgo: number, n: number, counted = true) {
  return Array.from({ length: n }, (_, index) => ({
    started_at: new Date(2026, 10, 25 - weeksAgo * 7, 7, index).toISOString(),
    counted,
  }));
}

describe('한 주의 시작', () => {
  it('월요일 0시다', () => {
    expect(new Date(startOfWeek(THURSDAY)).toString()).toBe(new Date(2026, 10, 23).toString());
    expect(startOfWeek(MONDAY)).toBe(new Date(2026, 10, 23).getTime());
  });

  it('일요일은 그 전 월요일의 주에 든다', () => {
    const sunday = new Date(2026, 10, 29, 23, 59).getTime();
    expect(startOfWeek(sunday)).toBe(new Date(2026, 10, 23).getTime());
  });

  it('돌아보는 기간의 시작은 이번 주를 포함해 26주 전의 월요일이다', () => {
    const start = new Date(streakWindowStart(THURSDAY));
    expect(start.getDay()).toBe(1);
    expect(Math.round((startOfWeek(THURSDAY) - start.getTime()) / (7 * 24 * 3600 * 1000))).toBe(STREAK_LOOKBACK_WEEKS - 1);
  });
});

describe('주 목표 달성 카드', () => {
  it('최근 8주의 칸을 오래된 주부터 그리고, 채운 주를 표시한다', () => {
    const runs = [...runsInWeek(0, 1), ...runsInWeek(1, 3), ...runsInWeek(2, 2), ...runsInWeek(7, 3)];
    const view = describeGoalWeeks(runs, 3, THURSDAY);

    expect(view.cells).toHaveLength(SHOWN_WEEKS);
    expect(view.cells.map((cell) => cell.met)).toEqual([true, false, false, false, false, false, true, false]);
    expect(view.cells.map((cell) => cell.count)).toEqual([3, 0, 0, 0, 0, 2, 3, 1]);
    expect(view.cells[7]).toMatchObject({ label: '11월 23일', title: '11월 23일 주 · 1회', isCurrent: true });
    expect(view.cells[6]).toMatchObject({ label: '11월 16일', isCurrent: false });
    expect(view.caption).toBe('최근 8주 · 주 3회 목표');
  });

  it('지난주까지 이어 채웠으면, 이번 주를 아직 못 채워도 연속이 끊기지 않는다', () => {
    const runs = [...runsInWeek(0, 1), ...runsInWeek(1, 3), ...runsInWeek(2, 3), ...runsInWeek(3, 4)];
    expect(describeGoalWeeks(runs, 3, THURSDAY).headline).toBe('3주 연속');
  });

  it('이번 주도 채웠으면 한 주를 더한다', () => {
    const runs = [...runsInWeek(0, 3), ...runsInWeek(1, 3), ...runsInWeek(2, 3)];
    expect(describeGoalWeeks(runs, 3, THURSDAY).headline).toBe('3주 연속');
    expect(describeGoalWeeks([...runsInWeek(0, 3)], 3, THURSDAY).headline).toBe('1주 연속');
  });

  it('지난주를 못 채웠으면 그 앞의 연속은 세지 않는다', () => {
    const runs = [...runsInWeek(1, 2), ...runsInWeek(2, 3), ...runsInWeek(3, 3)];
    expect(describeGoalWeeks(runs, 3, THURSDAY).headline).toBe('이번 주 0 / 3회');
  });

  it('연속이 없으면 이번 주의 횟수를 보여 준다', () => {
    expect(describeGoalWeeks(runsInWeek(0, 2), 3, THURSDAY).headline).toBe('이번 주 2 / 3회');
    expect(describeGoalWeeks([], 3, THURSDAY).headline).toBe('이번 주 0 / 3회');
  });

  it('10분을 못 채운 러닝은 세지 않는다', () => {
    const runs = [...runsInWeek(1, 2), ...runsInWeek(1, 5, false)];
    const view = describeGoalWeeks(runs, 3, THURSDAY);
    expect(view.cells[6]).toMatchObject({ count: 2, met: false });
  });

  it('주 목표가 바뀌면 지난 주들도 새 목표로 본다(Q-005 임시 처리)', () => {
    const runs = [...runsInWeek(1, 2), ...runsInWeek(2, 2)];
    expect(describeGoalWeeks(runs, 3, THURSDAY).headline).toBe('이번 주 0 / 3회');
    expect(describeGoalWeeks(runs, 2, THURSDAY).headline).toBe('2주 연속');
  });

  it('일요일 밤과 월요일 새벽의 러닝은 다른 주로 센다', () => {
    const runs = [
      { started_at: new Date(2026, 10, 22, 23, 50).toISOString(), counted: true },
      { started_at: new Date(2026, 10, 23, 0, 10).toISOString(), counted: true },
    ];
    const view = describeGoalWeeks(runs, 1, THURSDAY);
    expect(view.cells[6].count).toBe(1);
    expect(view.cells[7].count).toBe(1);
  });

  it('돌아보는 기간(26주)을 모두 채웠으면 그 수까지만 센다', () => {
    const runs = Array.from({ length: 40 }, (_, weeksAgo) => runsInWeek(weeksAgo, 3)).flat();
    expect(describeGoalWeeks(runs, 3, THURSDAY).headline).toBe(`${STREAK_LOOKBACK_WEEKS}주 연속`);
  });

  it('읽을 수 없는 시각의 러닝은 건너뛴다', () => {
    expect(describeGoalWeeks([{ started_at: 'yesterday', counted: true }], 1, THURSDAY).headline).toBe('이번 주 0 / 1회');
  });
});
