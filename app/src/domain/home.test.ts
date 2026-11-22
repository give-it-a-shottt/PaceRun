import { describe, expect, it } from 'vitest';

import { comparePace, previousComparable } from './compare';
import { describeHome, nextSession, parsePlanLabel, type FinishedRun } from './home';
import type { PlanItem } from './types';
import { addDays, msUntilNextDay, startOfDay, startOfWeek, weekdayIndex, weekLabel } from './week';
import { streakText, weekCells, weekProgress } from './weekProgress';

// 2026-11-26은 목요일이다. 그 주는 11-23(월) ~ 11-29(일).
const THURSDAY = new Date(2026, 10, 26, 9, 0).getTime();
const MONDAY = new Date(2026, 10, 23, 0, 0).getTime();
const at = (month: number, day: number, hour = 7) => new Date(2026, month - 1, day, hour, 0).getTime();

let seq = 0;
function run(startedAt: number, overrides: Partial<FinishedRun> = {}): FinishedRun {
  seq += 1;
  return {
    id: `run-${seq}`,
    mode: 'interval',
    planLabel: null,
    startedAt,
    elapsedMs: 20 * 60_000,
    distanceM: 3000,
    avgPaceSecPerKm: 400,
    counted: true,
    ...overrides,
  };
}

const INTERVAL: PlanItem = {
  weekday: 3,
  mode: 'interval',
  config: { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 },
  label: '인터벌 입문',
};

describe('주 계산', () => {
  it('한 주는 월요일 0시에 시작한다', () => {
    expect(startOfWeek(THURSDAY)).toBe(MONDAY);
    expect(startOfWeek(MONDAY)).toBe(MONDAY);
    // 일요일 밤 11시 59분도 그 주다
    expect(startOfWeek(new Date(2026, 10, 29, 23, 59).getTime())).toBe(MONDAY);
    // 월요일 0시 직전은 지난주다
    expect(startOfWeek(MONDAY - 1)).toBe(addDays(MONDAY, -7));
  });

  it('요일 번호는 0=월 … 6=일', () => {
    expect(weekdayIndex(MONDAY)).toBe(0);
    expect(weekdayIndex(THURSDAY)).toBe(3);
    expect(weekdayIndex(at(11, 29))).toBe(6);
  });

  it('해를 넘어가는 주도 월요일로 맞춘다', () => {
    // 2027-01-01은 금요일. 그 주의 월요일은 2026-12-28
    expect(startOfWeek(new Date(2027, 0, 1, 12).getTime())).toBe(new Date(2026, 11, 28).getTime());
  });

  it('"11월 4주차" — 목요일이 속한 달로 센다', () => {
    expect(weekLabel(THURSDAY)).toBe('11월 4주차');
    // 11-30(월) ~ 12-06(일)의 목요일은 12-03 → 12월 1주차
    expect(weekLabel(at(11, 30))).toBe('12월 1주차');
    // 12-28(월) ~ 01-03(일)의 목요일은 12-31 → 12월 5주차
    expect(weekLabel(new Date(2027, 0, 2).getTime())).toBe('12월 5주차');
  });

  it('다음 날 0시까지 남은 시간', () => {
    expect(msUntilNextDay(new Date(2026, 10, 26, 23, 59, 30).getTime())).toBe(30_000);
    expect(msUntilNextDay(new Date(2026, 10, 26, 0, 0, 0).getTime())).toBe(24 * 3_600_000);
  });

  it('기록이 한참 비어 있다가 다시 뛰어도, 빈 주에서 끊고 더 거슬러 올라가지 않는다', () => {
    // 지난주 3번, 그 앞 3주는 비어 있고, 한 달 전 주에 3번
    const runs = [...[16, 18, 20].map((day) => run(at(11, day))), ...[19, 21, 23].map((day) => run(at(10, day)))];
    expect(weekProgress(runs, 3, THURSDAY).previousStreak).toBe(1);
  });

  it('날짜 더하기는 0시를 유지한다', () => {
    expect(addDays(MONDAY, 3)).toBe(startOfDay(THURSDAY));
  });
});

describe('이번 주 횟수와 주 연속', () => {
  it('10분을 채운 러닝만 센다', () => {
    const runs = [run(at(11, 23)), run(at(11, 24)), run(at(11, 25), { counted: false })];
    expect(weekProgress(runs, 3, THURSDAY)).toMatchObject({ count: 2, goal: 3, met: false });
  });

  it('지난주 기록은 이번 주 횟수에 넣지 않는다', () => {
    const runs = [run(MONDAY - 1), run(MONDAY)];
    expect(weekProgress(runs, 3, THURSDAY).count).toBe(1);
  });

  it('목표를 채운 주가 이어진 수를 센다. 이번 주는 채웠을 때만 더한다', () => {
    const lastWeek = [run(at(11, 16)), run(at(11, 18)), run(at(11, 20))];
    const twoWeeksAgo = [run(at(11, 9)), run(at(11, 11)), run(at(11, 14))];
    const thisWeek = [run(at(11, 23)), run(at(11, 24))];

    const progress = weekProgress([...lastWeek, ...twoWeeksAgo, ...thisWeek], 3, THURSDAY);
    expect(progress).toMatchObject({ previousStreak: 2, streak: 2, met: false });

    const met = weekProgress([...lastWeek, ...twoWeeksAgo, ...thisWeek, run(at(11, 26))], 3, THURSDAY);
    expect(met).toMatchObject({ previousStreak: 2, streak: 3, met: true });
  });

  it('목표를 못 채운 주에서 끊긴다(그 앞의 주는 세지 않는다)', () => {
    const runs = [
      ...[16, 18, 20].map((day) => run(at(11, day))), // 지난주: 채움
      run(at(11, 10)), // 2주 전: 1번뿐
      ...[2, 4, 6].map((day) => run(at(11, day))), // 3주 전: 채움
    ];
    expect(weekProgress(runs, 3, THURSDAY).previousStreak).toBe(1);
  });

  it('하루에 몰아서 뛰지 않아도, 빠진 날이 있어도 주 목표만 채우면 이어진다', () => {
    const runs = [run(at(11, 16)), run(at(11, 21)), run(at(11, 22))];
    expect(weekProgress(runs, 3, THURSDAY).previousStreak).toBe(1);
  });

  it('주 목표를 낮추면 지난 주들도 새 목표로 다시 센다', () => {
    const runs = [run(at(11, 16)), run(at(11, 18))];
    expect(weekProgress(runs, 3, THURSDAY).previousStreak).toBe(0);
    expect(weekProgress(runs, 2, THURSDAY).previousStreak).toBe(1);
  });

  it('기록이 없으면 0이다', () => {
    expect(weekProgress([], 3, THURSDAY)).toEqual({ count: 0, goal: 3, met: false, previousStreak: 0, streak: 0 });
  });

  it('주 연속 한 줄', () => {
    const base = { count: 0, goal: 3 };
    expect(streakText({ ...base, met: false, previousStreak: 3, streak: 3 })).toBe('3주 연속 목표 달성 중');
    expect(streakText({ ...base, met: false, previousStreak: 1, streak: 1 })).toBe(
      '지난주 목표 달성 · 이번 주도 이어 가요',
    );
    expect(streakText({ ...base, met: true, previousStreak: 3, streak: 4 })).toBe('4주 연속 목표 달성!');
    expect(streakText({ ...base, met: true, previousStreak: 0, streak: 1 })).toBe('이번 주 목표 달성!');
    expect(streakText({ ...base, met: false, previousStreak: 0, streak: 0 })).toBeNull();
  });
});

describe('주간 칸', () => {
  it('뛴 날은 완료, 오늘은 오늘, 앞으로 올 계획 있는 날은 계획, 나머지는 쉼', () => {
    const cells = weekCells([run(at(11, 23)), run(at(11, 24))], new Set([0, 3, 5]), THURSDAY);

    expect(cells.map((cell) => cell.state)).toEqual(['done', 'done', 'rest', 'today', 'rest', 'planned', 'rest']);
    expect(cells.map((cell) => cell.label).join('')).toBe('월화수목금토일');
    expect(cells[3].isToday).toBe(true);
    expect(cells[5].accessibilityLabel).toBe('토요일, 계획 있음');
    expect(cells[3].accessibilityLabel).toBe('목요일, 오늘, 아직 뛰지 않음');
  });

  it('오늘 뛰었으면 오늘 칸이 완료가 된다', () => {
    const cells = weekCells([run(at(11, 26, 7))], new Set(), THURSDAY);
    expect(cells[3]).toMatchObject({ state: 'done', isToday: true, accessibilityLabel: '목요일, 오늘, 완료' });
  });

  it('계획이 있었지만 못 뛴 지난 날은 쉼으로 보인다', () => {
    const cells = weekCells([], new Set([0, 1]), THURSDAY);
    expect(cells[0].state).toBe('rest');
    expect(cells[1].state).toBe('rest');
  });

  it('10분을 못 채운 러닝은 칸을 칠하지 않는다', () => {
    const cells = weekCells([run(at(11, 23), { counted: false })], new Set(), THURSDAY);
    expect(cells[0].state).toBe('rest');
  });

  it('지난주 같은 요일의 기록으로 칠하지 않는다', () => {
    const cells = weekCells([run(at(11, 16))], new Set(), THURSDAY);
    expect(cells[0].state).toBe('rest');
  });
});

describe('회차', () => {
  it('이름에서 회차를 읽는다', () => {
    expect(parsePlanLabel('인터벌 입문 3회차')).toEqual({ base: '인터벌 입문', session: 3 });
    expect(parsePlanLabel('10분만 뛰기')).toBeNull();
    expect(parsePlanLabel(null)).toBeNull();
  });

  it('같은 이름으로 인정된 기록의 가장 큰 회차 다음 번호다', () => {
    const runs = [
      run(at(11, 2), { planLabel: '인터벌 입문 1회차' }),
      run(at(11, 4), { planLabel: '인터벌 입문 2회차' }),
      run(at(11, 6), { planLabel: '케이던스 연습 5회차' }),
    ];
    expect(nextSession('인터벌 입문', runs)).toBe(3);
    expect(nextSession('페이스 유지', runs)).toBe(1);
  });

  it('10분을 못 채운 기록은 회차를 올리지 않는다', () => {
    const runs = [run(at(11, 2), { planLabel: '인터벌 입문 1회차', counted: false })];
    expect(nextSession('인터벌 입문', runs)).toBe(1);
  });
});

describe('지난번 비교', () => {
  const current = run(at(11, 26), { avgPaceSecPerKm: 362 });

  it('같은 모드의 바로 앞 기록과 비교한다', () => {
    const runs = [
      run(at(11, 20), { avgPaceSecPerKm: 370 }),
      run(at(11, 10), { avgPaceSecPerKm: 300 }),
      run(at(11, 24), { mode: 'free', avgPaceSecPerKm: 300 }),
      current,
    ];
    const previous = previousComparable(current, runs);
    expect(previous?.avgPaceSecPerKm).toBe(370);
    expect(comparePace(current, previous)).toBe('지난번보다 페이스가 8초 빨라졌어요');
  });

  it('느려졌거나 같으면 그대로 말한다', () => {
    expect(comparePace(current, run(at(11, 20), { avgPaceSecPerKm: 357 }))).toBe('지난번보다 5초 천천히 뛰었어요');
    expect(comparePace(current, run(at(11, 20), { avgPaceSecPerKm: 362.2 }))).toBe('지난번과 같은 페이스로 뛰었어요');
  });

  it('지난 기록이 없으면 첫 기록이라고 알린다', () => {
    expect(comparePace(current, null)).toBe('첫 인터벌 기록이에요');
    expect(comparePace(run(at(11, 26), { mode: 'free' }), null)).toBe('첫 자유 러닝 기록이에요');
  });

  it('이번 페이스를 알 수 없으면 비교하지 않는다', () => {
    expect(comparePace({ ...current, avgPaceSecPerKm: null }, run(at(11, 20)))).toBeNull();
  });

  it('페이스가 없는 지난 기록은 건너뛴다', () => {
    const runs = [run(at(11, 20), { avgPaceSecPerKm: null }), run(at(11, 10), { avgPaceSecPerKm: 380 })];
    expect(previousComparable(current, runs)?.avgPaceSecPerKm).toBe(380);
  });
});

describe('오늘의 러닝 카드', () => {
  const home = (plan: PlanItem[], runs: FinishedRun[], now = THURSDAY) =>
    describeHome({ now, weeklyGoal: 3, plan, runs });

  it('오늘 계획이 있으면 그 운동을 보여 준다', () => {
    const runs = [
      run(at(11, 16), { planLabel: '인터벌 입문 1회차', avgPaceSecPerKm: 370 }),
      run(at(11, 19), { planLabel: '인터벌 입문 2회차', avgPaceSecPerKm: 365 }),
    ];
    const view = home([INTERVAL], runs);

    expect(view.today).toEqual({
      kind: 'planned',
      mode: 'interval',
      title: '인터벌 입문 3회차',
      description: '1분 달리기 + 1분 30초 걷기 × 8',
      estimate: '약 20분',
      lastPaceText: `지난번 6'05"/km`,
      reason: '걷기에서 숨을 고르면 막판이 덜 처져요',
      config: INTERVAL.config,
      planLabel: '인터벌 입문 3회차',
      startLabel: '시작',
    });
  });

  it('같은 모드로 뛴 적이 없으면 지난번 페이스가 없다', () => {
    const view = home([INTERVAL], [run(at(11, 16), { mode: 'free' })]);
    expect(view.today).toMatchObject({ kind: 'planned', lastPaceText: null, title: '인터벌 입문 1회차' });
  });

  it('계획이 아예 없으면 자유 20분을 권한다', () => {
    const view = home([], []);
    expect(view.today).toMatchObject({
      kind: 'noPlan',
      title: '자유 20분',
      startLabel: '자유 20분 시작',
      config: { mode: 'free', targetDurationSec: 1200 },
    });
  });

  it('계획은 있지만 오늘이 아니면 쉬는 날이고, 다음 러닝을 알려 준다', () => {
    const saturday: PlanItem = { ...INTERVAL, weekday: 5 };
    const view = home([saturday], [run(at(11, 16), { planLabel: '인터벌 입문 2회차' })]);

    expect(view.today).toEqual({
      kind: 'restDay',
      mode: 'free',
      title: '오늘은 쉬는 날이에요',
      message: '다음 러닝은 토요일 인터벌 입문 3회차예요. 몸이 가볍다면 10분만 뛰어도 1회로 인정돼요.',
      quickRunLabel: '가볍게 10분 뛰기',
      otherLabel: '다른 운동으로 뛰기',
    });
  });

  it('이번 주에 남은 계획이 없으면 다음 주 요일로 알려 준다', () => {
    const monday: PlanItem = { ...INTERVAL, weekday: 0 };
    const view = home([monday], []);
    expect(view.today).toMatchObject({ kind: 'restDay' });
    expect(view.today.kind === 'restDay' && view.today.message).toContain('다음 러닝은 다음 주 월요일 인터벌 입문 1회차예요.');
  });

  it('오늘 인정된 러닝이 있으면 완료 카드와 지난번 비교를 보여 준다', () => {
    const runs = [
      run(at(11, 19), { planLabel: '인터벌 입문 2회차', avgPaceSecPerKm: 370 }),
      run(at(11, 26, 7), {
        id: 'today',
        planLabel: '인터벌 입문 3회차',
        distanceM: 3125,
        elapsedMs: 20 * 60_000 + 14_000,
        avgPaceSecPerKm: 362,
      }),
    ];
    const view = home([INTERVAL], runs);

    expect(view.today).toEqual({
      kind: 'done',
      runId: 'today',
      mode: 'interval',
      title: '인터벌 입문 3회차',
      stats: `3.12 km · 20:14 · 평균 6'02"/km`,
      comparison: '지난번보다 페이스가 8초 빨라졌어요',
      recordsLabel: '기록 보기',
      againLabel: '한 번 더 뛰기',
    });
  });

  it('계획의 요일 값이 망가져 다음 러닝을 찾지 못하면 그 문장만 뺀다', () => {
    const broken: PlanItem = { ...INTERVAL, weekday: 9 };
    const view = home([broken], []);
    expect(view.today).toMatchObject({
      kind: 'restDay',
      message: '몸이 가볍다면 10분만 뛰어도 1회로 인정돼요.',
    });
  });

  it('오늘 뛰었지만 10분을 못 채웠으면 아직 오늘 뛸 것을 보여 준다', () => {
    const view = home([INTERVAL], [run(at(11, 26, 7), { counted: false })]);
    expect(view.today.kind).toBe('planned');
  });

  it('계획 없이 뛴 기록은 모드 이름으로 보여 주고, 페이스가 없으면 뺀다', () => {
    const view = home([], [run(at(11, 26, 7), { mode: 'free', avgPaceSecPerKm: null, distanceM: 40 })]);
    expect(view.today).toMatchObject({ kind: 'done', title: '자유 러닝', stats: '0.04 km · 20:00', comparison: '첫 자유 러닝 기록이에요' });
  });

  it('맨 위 제목과 주 연속 줄', () => {
    const lastWeek = [16, 18, 20].map((day) => run(at(11, day)));
    const twoDone = home([INTERVAL], [...lastWeek, run(at(11, 23)), run(at(11, 24))]);
    expect(twoDone.weekLabel).toBe('11월 4주차');
    expect(twoDone.title).toBe('이번 주 2 / 3회');
    expect(twoDone.streakText).toBe('지난주 목표 달성 · 이번 주도 이어 가요');

    const met = home([INTERVAL], [...lastWeek, run(at(11, 23)), run(at(11, 24)), run(at(11, 26, 7))]);
    expect(met.title).toBe('이번 주 3 / 3회 · 목표 달성');
    expect(met.streakText).toBe('2주 연속 목표 달성!');
    expect(met.cells[3]).toMatchObject({ state: 'done', isToday: true });
  });
});
