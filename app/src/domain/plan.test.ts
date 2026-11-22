import { describe, expect, it } from 'vitest';

import type { FinishedRun } from './home';
import {
  describePlan,
  PLAN_TEMPLATES,
  templateDays,
  withoutWorkout,
  withWorkout,
  workoutLabel,
  workoutSheetTitle,
} from './plan';
import { isRunConfig } from './settings';
import type { PlanItem } from './types';

// 2026-11-19는 목요일이다. 그 주는 11-16(월) ~ 11-22(일).
const THURSDAY = new Date(2026, 10, 19, 9, 0).getTime();
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

const INTERVAL_TEMPLATE = PLAN_TEMPLATES[0];

describe('템플릿', () => {
  it('네 개가 있고 모두 주 3회다', () => {
    expect(PLAN_TEMPLATES.map((template) => template.title)).toEqual([
      '인터벌 입문',
      '발걸음 박자 연습',
      '페이스 유지',
      '혼합',
    ]);
    for (const template of PLAN_TEMPLATES) expect(template.items).toHaveLength(3);
  });

  it('요일이 겹치지 않고, 목표값이 저장할 수 있는 모양이다', () => {
    for (const template of PLAN_TEMPLATES) {
      const weekdays = template.items.map((planned) => planned.weekday);
      expect(new Set(weekdays).size).toBe(weekdays.length);
      for (const planned of template.items) {
        expect(planned.weekday).toBeGreaterThanOrEqual(0);
        expect(planned.weekday).toBeLessThanOrEqual(6);
        expect(isRunConfig(planned.config)).toBe(true);
        expect(planned.config.mode).toBe(planned.mode);
      }
    }
  });

  it('요일 배치를 월~일 7칸으로 보여 준다', () => {
    expect(templateDays(INTERVAL_TEMPLATE).map((day) => day.mode)).toEqual([
      'interval', null, null, 'interval', null, 'interval', null,
    ]);
    const mixed = templateDays(PLAN_TEMPLATES[3]);
    expect(mixed.map((day) => day.label).join('')).toBe('월화수목금토일');
    expect([mixed[0].mode, mixed[2].mode, mixed[5].mode]).toEqual(['interval', 'cadence', 'pacemaker']);
  });
});

describe('계획 고치기', () => {
  const plan: PlanItem[] = [...INTERVAL_TEMPLATE.items];

  it('빈 요일에 운동을 넣으면 모드 이름이 운동 이름이 되고 요일 순으로 놓인다', () => {
    const next = withWorkout(plan, 1, { mode: 'cadence', spm: 170, durationSec: 1200 });
    expect(next.map((planned) => planned.weekday)).toEqual([0, 1, 3, 5]);
    expect(next[1]).toMatchObject({ weekday: 1, mode: 'cadence', label: '발걸음 박자' });
  });

  it('같은 모드로 목표값만 고치면 원래 이름을 지킨다', () => {
    const next = withWorkout(plan, 0, { mode: 'interval', runSec: 120, walkSec: 60, repeats: 5 });
    expect(next).toHaveLength(3);
    expect(next[0]).toMatchObject({ label: '인터벌 입문', config: { runSec: 120 } });
  });

  it('모드를 바꾸면 새 모드의 이름이 된다', () => {
    const next = withWorkout(plan, 0, { mode: 'free', targetDurationSec: 1800 });
    expect(next[0]).toMatchObject({ mode: 'free', label: '자유 러닝' });
    expect(workoutLabel('interval', null)).toBe('인터벌');
  });

  it('요일을 비운다. 없는 요일을 비워도 그대로다', () => {
    expect(withoutWorkout(plan, 3).map((planned) => planned.weekday)).toEqual([0, 5]);
    expect(withoutWorkout(plan, 1)).toHaveLength(3);
  });

  it('원래 계획을 바꾸지 않는다', () => {
    withWorkout(plan, 1, { mode: 'free', targetDurationSec: null });
    withoutWorkout(plan, 0);
    expect(plan).toEqual(INTERVAL_TEMPLATE.items);
  });

  it('바텀시트 제목', () => {
    expect(workoutSheetTitle(4, false)).toBe('금요일에 운동 추가');
    expect(workoutSheetTitle(3, true)).toBe('목요일 운동 바꾸기');
  });
});

describe('계획 탭에 그릴 값', () => {
  const view = (plan: readonly PlanItem[], runs: FinishedRun[] = [], now = THURSDAY) =>
    describePlan({ now, plan, runs });

  it('이번 주 날짜와 합계', () => {
    const result = view(INTERVAL_TEMPLATE.items);
    expect(result.rangeText).toBe('11월 16일 – 22일');
    expect(result.summaryText).toBe('주 3회 · 약 60분');
    expect(result.days.map((day) => day.dateText)).toEqual(['16', '17', '18', '19', '20', '21', '22']);
    expect(result.isEmpty).toBe(false);
  });

  it('주가 두 달에 걸치면 끝 날짜에 달을 붙인다', () => {
    expect(view([], [], at(11, 30)).rangeText).toBe('11월 30일 – 12월 6일');
  });

  it('뛴 날은 완료, 오늘은 다음 회차, 남은 날은 그다음 회차로 차례대로 보여 준다', () => {
    const runs = [
      run(at(11, 9), { planLabel: '인터벌 입문 1회차' }),
      run(at(11, 16), { planLabel: '인터벌 입문 2회차' }),
    ];
    const days = view(INTERVAL_TEMPLATE.items, runs).days;

    expect(days[0].workout).toMatchObject({ title: '인터벌 입문 2회차', status: 'done', mode: 'interval' });
    expect(days[3].workout).toMatchObject({ title: '인터벌 입문 3회차', status: 'today' });
    expect(days[5].workout).toMatchObject({ title: '인터벌 입문 4회차', status: 'upcoming' });
    expect(days[1].workout).toBeNull();
    expect(days[3].isToday).toBe(true);
    expect(days[3].workout?.description).toBe('1분 달리기 + 1분 30초 걷기 × 8');
  });

  it('지나간 계획일에 뛰지 않았으면 회차 없이 이름만 보여 준다', () => {
    const days = view(INTERVAL_TEMPLATE.items, []).days;
    expect(days[0].workout).toMatchObject({ title: '인터벌 입문', status: 'past' });
    // 오늘부터 1회차
    expect(days[3].workout?.title).toBe('인터벌 입문 1회차');
    expect(days[5].workout?.title).toBe('인터벌 입문 2회차');
  });

  it('다른 이름의 운동은 회차를 따로 센다', () => {
    const mixed = PLAN_TEMPLATES[3].items; // 월 인터벌 · 수 박자 · 토 페이스
    const runs = [run(at(11, 11), { mode: 'pacemaker', planLabel: '페이스 유지 4회차' })];
    const days = view(mixed, runs, at(11, 17)).days; // 화요일
    expect(days[2].workout?.title).toBe('발걸음 박자 연습 1회차');
    expect(days[5].workout?.title).toBe('페이스 유지 5회차');
  });

  it('그날 뛰었어도 이 계획의 러닝이 아니거나 10분을 못 채웠으면 완료가 아니다', () => {
    const quick = [run(at(11, 19, 6), { mode: 'free', planLabel: '10분만 뛰기' })];
    expect(view(INTERVAL_TEMPLATE.items, quick).days[3].workout?.status).toBe('today');

    const short = [run(at(11, 19, 6), { planLabel: '인터벌 입문 1회차', counted: false })];
    expect(view(INTERVAL_TEMPLATE.items, short).days[3].workout).toMatchObject({ status: 'today', title: '인터벌 입문 1회차' });
  });

  it('지난주에 뛴 기록으로 이번 주 칸을 완료로 보지 않는다', () => {
    const lastWeek = [run(at(11, 12), { planLabel: '인터벌 입문 1회차' })]; // 지난주 목요일
    expect(view(INTERVAL_TEMPLATE.items, lastWeek).days[3].workout).toMatchObject({
      status: 'today',
      title: '인터벌 입문 2회차',
    });
  });

  it('읽어 주는 문구', () => {
    const runs = [run(at(11, 16), { planLabel: '인터벌 입문 1회차' })];
    const days = view(INTERVAL_TEMPLATE.items, runs).days;
    expect(days[0].accessibilityLabel).toBe('월요일, 인터벌 입문 1회차, 완료');
    expect(days[3].accessibilityLabel).toBe('목요일, 오늘, 인터벌 입문 2회차');
    expect(days[4].accessibilityLabel).toBe('금요일, 운동 없음');
  });

  it('계획이 없으면 빈 상태다', () => {
    const result = view([]);
    expect(result.isEmpty).toBe(true);
    expect(result.summaryText).toBe('주 0회');
    expect(result.days.every((day) => day.workout === null)).toBe(true);
    expect(result.nextEmptyWeekday).toBe(3); // 오늘(목)
  });

  it('시간 제한 없는 자유 러닝이 섞이면 합계 시간을 보여 주지 않는다', () => {
    const plan = withWorkout(INTERVAL_TEMPLATE.items, 1, { mode: 'free', targetDurationSec: null });
    expect(view(plan).summaryText).toBe('주 4회');
  });

  it('[+]로 추가할 요일은 오늘부터 찾은 첫 빈 요일이고, 없으면 다음 주로 넘어가 찾는다', () => {
    expect(view(INTERVAL_TEMPLATE.items).nextEmptyWeekday).toBe(4); // 목(오늘)은 차 있고 금이 비어 있다
    const lateWeek: PlanItem[] = [3, 4, 5, 6].map((weekday) => ({ ...INTERVAL_TEMPLATE.items[0], weekday }));
    expect(view(lateWeek).nextEmptyWeekday).toBe(0);
    const full: PlanItem[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ ...INTERVAL_TEMPLATE.items[0], weekday }));
    expect(view(full).nextEmptyWeekday).toBeNull();
  });
});
