import { describe, expect, it } from 'vitest';

import { describeComparison } from './compare';
import { formatClock, formatDateTime, formatMonthDay, formatTimeRange } from './format';
import type { FinishedRun } from './home';
import { describeRecords, describeRunDetail, describeSummary } from './records';
import { projectRoute } from './route';
import type { RunSegment } from './runEngine';
import type { PlanItem } from './types';
import { weekRangeText } from './week';

// 2026-11-19는 목요일이다. 그 주는 11-16(월) ~ 11-22(일).
const THURSDAY = new Date(2026, 10, 19, 21, 0).getTime();
const at = (month: number, day: number, hour = 7, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

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

const PACE_PLAN: PlanItem = {
  weekday: 1,
  mode: 'pacemaker',
  config: { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 },
  label: '페이스 유지',
};

describe('날짜와 시각 표기', () => {
  it('오전 · 오후와 12시', () => {
    expect(formatClock(at(11, 20, 7, 12))).toBe('오전 7:12');
    expect(formatClock(at(11, 20, 21, 40))).toBe('오후 9:40');
    expect(formatClock(at(11, 20, 0, 5))).toBe('오전 12:05');
    expect(formatClock(at(11, 20, 12, 0))).toBe('오후 12:00');
  });

  it('날짜와 요일', () => {
    expect(formatMonthDay(at(11, 20))).toBe('11월 20일');
    expect(formatDateTime(at(11, 20, 7, 12))).toBe('11월 20일 (금) 오전 7:12');
    expect(formatDateTime(at(11, 22, 23, 59))).toBe('11월 22일 (일) 오후 11:59');
  });

  it('시작 ~ 끝: 같은 오전/오후면 끝에는 되풀이하지 않고, 바뀌면 붙인다', () => {
    expect(formatTimeRange(at(11, 20, 7, 12), at(11, 20, 7, 32))).toBe('11월 20일 (금) 오전 7:12 – 7:32');
    expect(formatTimeRange(at(11, 20, 11, 50), at(11, 20, 12, 20))).toBe('11월 20일 (금) 오전 11:50 – 오후 12:20');
  });

  it('주의 날짜 범위', () => {
    expect(weekRangeText(THURSDAY)).toBe('11월 16일 – 22일');
    expect(weekRangeText(at(11, 30))).toBe('11월 30일 – 12월 6일');
  });
});

describe('기록 탭', () => {
  const view = (runs: FinishedRun[], plan: PlanItem[] = [], now = THURSDAY) => describeRecords({ now, plan, runs });

  it('기록이 하나도 없으면 빈 상태다', () => {
    const result = view([]);
    expect(result.isEmpty).toBe(true);
    expect(result.totalText).toBe('0.0 km · 0회');
    expect(result.items).toEqual([]);
    expect(result.chart.bars.every((bar) => bar.valueText === null && bar.ratio === 0)).toBe(true);
  });

  it('이번 주 요일별 거리를 막대로, 합계와 인정 횟수를 제목으로 준다', () => {
    const runs = [
      run(at(11, 16), { distanceM: 2410 }),
      run(at(11, 17, 21), { distanceM: 1600, mode: 'free' }),
      run(at(11, 19), { distanceM: 3120 }),
    ];
    const result = view(runs);

    expect(result.rangeText).toBe('이번 주 · 11월 16일 – 22일');
    expect(result.totalText).toBe('7.1 km · 3회');
    expect(result.chart.bars.map((bar) => bar.valueText)).toEqual(['2.4', '1.6', null, '3.1', null, null, null]);
    expect(result.chart.bars[3]).toMatchObject({ label: '목', isToday: true, ratio: 1 });
    expect(result.chart.bars[0].ratio).toBeCloseTo(2410 / 3120, 5);
    expect(result.chart.accessibilityLabel).toBe(
      '이번 주 요일별 거리, 월요일 2.4킬로미터, 화요일 1.6킬로미터, 목요일 3.1킬로미터',
    );
  });

  it('같은 날 여러 번 뛰면 거리를 더한다. 10분을 못 채운 러닝은 거리에는 넣고 횟수에서는 뺀다', () => {
    const runs = [
      run(at(11, 16, 7), { distanceM: 2000 }),
      run(at(11, 16, 20), { distanceM: 1000, counted: false, elapsedMs: 5 * 60_000 }),
    ];
    const result = view(runs);
    expect(result.chart.bars[0].valueText).toBe('3.0');
    expect(result.totalText).toBe('3.0 km · 1회');
  });

  it('지난주 기록은 막대와 합계에 넣지 않고 목록에는 보여 준다', () => {
    const result = view([run(at(11, 15, 23)), run(at(11, 16, 0), { distanceM: 1000 })]);
    expect(result.totalText).toBe('1.0 km · 1회');
    expect(result.items).toHaveLength(2);
  });

  it('목표선: 계획에 거리 목표가 있는 운동이 있을 때만 긋고, 막대보다 길면 목표선에 맞춘다', () => {
    const none = view([run(at(11, 16), { distanceM: 2000 })]);
    expect(none.chart.goal).toBeNull();
    expect(none.chart.bars[0].ratio).toBe(1);

    const withGoal = view([run(at(11, 16), { distanceM: 2000 })], [PACE_PLAN]);
    expect(withGoal.chart.goal).toEqual({ ratio: 1, text: '목표 3 km' });
    expect(withGoal.chart.bars[0].ratio).toBeCloseTo(2 / 3, 5);

    const longer = view([run(at(11, 16), { distanceM: 6000 })], [PACE_PLAN]);
    expect(longer.chart.goal?.ratio).toBeCloseTo(0.5, 5);
    expect(longer.chart.bars[0].ratio).toBe(1);
  });

  it('목표 거리가 여러 개면 가장 긴 것을 쓰고, 소수 거리는 그대로 적는다', () => {
    const half: PlanItem = { ...PACE_PLAN, weekday: 3, config: { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 5500 } };
    expect(view([], [PACE_PLAN, half]).chart.goal?.text).toBe('목표 5.5 km');
  });

  it('아주 짧은 거리(0.0으로 보이는 값)는 막대를 그리지 않는다', () => {
    const result = view([run(at(11, 16), { distanceM: 30, avgPaceSecPerKm: null })]);
    expect(result.chart.bars[0]).toMatchObject({ valueText: null, ratio: 0 });
  });

  it('목록은 최신순이고, 이름 · 날짜 · 거리 · 페이스를 준다', () => {
    const runs = [
      run(at(11, 16, 7, 5), { planLabel: '인터벌 입문 2회차', distanceM: 2410, avgPaceSecPerKm: 370 }),
      run(at(11, 19, 7, 12), { id: 'latest', planLabel: '인터벌 입문 3회차', distanceM: 3125, avgPaceSecPerKm: 362 }),
      run(at(11, 17, 21, 40), { mode: 'free', distanceM: 40, avgPaceSecPerKm: null }),
    ];
    const items = view(runs).items;

    expect(items.map((item) => item.title)).toEqual(['인터벌 입문 3회차', '자유 러닝', '인터벌 입문 2회차']);
    expect(items[0]).toEqual({
      id: 'latest',
      mode: 'interval',
      title: '인터벌 입문 3회차',
      dateText: '11월 19일 (목) 오전 7:12',
      distanceText: '3.12 km',
      paceText: `6'02"/km`,
      accessibilityLabel: '인터벌 입문 3회차, 11월 19일 (목) 오전 7:12, 3.12 km',
    });
    expect(items[1].paceText).toBeNull();
  });
});

describe('지난번 비교 상자', () => {
  const current = run(at(11, 19), { avgPaceSecPerKm: 362 });

  it('문장과 "어떤 기준으로 비교했는지"를 함께 준다', () => {
    expect(describeComparison(current, run(at(11, 16), { avgPaceSecPerKm: 370 }))).toEqual({
      text: '지난번보다 페이스가 8초 빨라졌어요',
      detail: `같은 인터벌 기준 · 6'10" → 6'02"`,
    });
  });

  it('지난 기록이 없으면 첫 기록 문장만 준다', () => {
    expect(describeComparison(current, null)).toEqual({ text: '첫 인터벌 기록이에요', detail: null });
  });

  it('이번 페이스를 알 수 없으면 상자를 그리지 않는다', () => {
    expect(describeComparison({ ...current, avgPaceSecPerKm: null }, run(at(11, 16)))).toBeNull();
  });
});

describe('러닝 상세', () => {
  const segment = (overrides: Partial<RunSegment>): RunSegment => ({
    idx: 0,
    kind: 'run',
    startedElapsedMs: 0,
    durationMs: 60_000,
    distanceM: 180,
    ...overrides,
  });

  it('제목 · 시각 · 지표 · 비교를 준다', () => {
    const previous = run(at(11, 16), { avgPaceSecPerKm: 370 });
    const target = {
      ...run(at(11, 19, 7, 12), { planLabel: '인터벌 입문 3회차', distanceM: 3125, elapsedMs: 1_214_000, avgPaceSecPerKm: 362 }),
      endedAt: at(11, 19, 7, 32),
    };
    const view = describeRunDetail({ run: target, segments: [], runs: [previous, target] });

    expect(view).toMatchObject({
      headerTitle: '11월 19일 러닝',
      mode: 'interval',
      title: '인터벌 입문 3회차',
      timeText: '11월 19일 (목) 오전 7:12 – 7:32',
      note: null,
      comparison: { text: '지난번보다 페이스가 8초 빨라졌어요' },
    });
    expect(view.stats).toEqual([
      { label: '거리', value: '3.12 km' },
      { label: '시간', value: '20:14' },
      { label: '평균 페이스', value: `6'02"/km` },
    ]);
  });

  it('10분을 못 채운 기록이면 그 사실을 알리고, 페이스를 모르면 빈 값으로 보여 준다', () => {
    const target = { ...run(at(11, 19), { counted: false, distanceM: 30, avgPaceSecPerKm: null, mode: 'free' as const }), endedAt: null };
    const view = describeRunDetail({ run: target, segments: [], runs: [target] });
    expect(view.note).toBe('10분을 채우지 못해 횟수에는 들어가지 않았어요');
    expect(view.stats[2].value).toBe(`-'--"`);
    expect(view.timeText).toBe('11월 19일 (목) 오전 7:00');
    expect(view.title).toBe('자유 러닝');
    // 지난 기록이 없으면 페이스를 몰라도 첫 기록이라고는 알려 준다
    expect(view.comparison).toEqual({ text: '첫 자유 러닝 기록이에요', detail: null });
  });

  it('구간 표: 인터벌은 달리기 · 걷기, km 구간은 거리로 적고 구간마다 페이스를 낸다', () => {
    const target = { ...run(at(11, 19)), endedAt: at(11, 19, 7, 20) };
    const view = describeRunDetail({
      run: target,
      runs: [target],
      segments: [
        segment({ idx: 0, kind: 'run', durationMs: 60_000, distanceM: 177.5 }),
        segment({ idx: 1, kind: 'walk', durationMs: 90_000, distanceM: 163 }),
        segment({ idx: 2, kind: 'km', durationMs: 372_000, distanceM: 1000.4 }),
        segment({ idx: 3, kind: 'km', durationMs: 150_000, distanceM: 420 }),
        segment({ idx: 4, kind: 'walk', durationMs: 90_000, distanceM: 0 }),
      ],
    });

    expect(view.segments).toEqual([
      { no: 1, kindText: '달리기', resting: false, durationText: '1:00', paceText: `5'38"` },
      { no: 2, kindText: '걷기', resting: true, durationText: '1:30', paceText: `9'12"` },
      { no: 3, kindText: '1km', resting: false, durationText: '6:12', paceText: `6'12"` },
      { no: 4, kindText: '0.42km', resting: false, durationText: '2:30', paceText: `5'57"` },
      { no: 5, kindText: '걷기', resting: true, durationText: '1:30', paceText: `-'--"` },
    ]);
  });
});

describe('완료 요약', () => {
  it('지표 · 인정 안내 · 이번 주 칸을 준다', () => {
    const lastWeek = [9, 11, 13].map((day) => run(at(11, day)));
    const thisWeek = [run(at(11, 16)), run(at(11, 17))];
    const finished = run(at(11, 19, 20, 30), { id: 'now', planLabel: '인터벌 입문 3회차', distanceM: 3125, elapsedMs: 1_129_000, avgPaceSecPerKm: 362 });
    const view = describeSummary({
      run: finished,
      runs: [...lastWeek, ...thisWeek, finished],
      plan: [{ weekday: 5, mode: 'interval', config: { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 }, label: '인터벌 입문' }],
      weeklyGoal: 3,
      now: THURSDAY,
    });

    expect(view).toMatchObject({
      mode: 'interval',
      title: '인터벌 입문 3회차',
      dateText: '11월 19일 (목) 오후 8:30',
      countedText: '오늘 1회 인정!',
      counted: true,
    });
    // 요약 화면의 페이스에는 "/km"를 붙이지 않는다(피그마)
    expect(view.stats.map((stat) => stat.value)).toEqual(['3.12 km', '18:49', `6'02"`]);
    expect(view.week.title).toBe('이번 주 3 / 3회');
    expect(view.week.note).toBe('목표 달성 · 2주 연속');
    expect(view.week.cells.map((cell) => cell.state)).toEqual(['done', 'done', 'rest', 'done', 'rest', 'planned', 'rest']);
    expect(view.week.paintKey).toBe('now');
  });

  it('주 목표를 아직 못 채웠으면 달성 문구가 없고, 처음 채운 주면 연속 수를 붙이지 않는다', () => {
    const finished = run(at(11, 19), { id: 'now' });
    const notYet = describeSummary({ run: finished, runs: [finished], plan: [], weeklyGoal: 3, now: THURSDAY });
    expect(notYet.week).toMatchObject({ title: '이번 주 1 / 3회', note: null });

    const first = describeSummary({ run: finished, runs: [finished], plan: [], weeklyGoal: 1, now: THURSDAY });
    expect(first.week.note).toBe('목표 달성');
  });

  it('10분을 못 채웠으면 인정되지 않았다고 알리고 칸을 칠하지 않는다', () => {
    const finished = run(at(11, 19), { id: 'now', counted: false, elapsedMs: 5 * 60_000 });
    const view = describeSummary({ run: finished, runs: [finished], plan: [], weeklyGoal: 3, now: THURSDAY });
    expect(view.countedText).toBe('10분을 채우지 못해 횟수에는 들어가지 않았어요');
    expect(view.counted).toBe(false);
    expect(view.week.paintKey).toBeNull();
    expect(view.week.cells[3].state).toBe('today');
  });
});

describe('경로 그림', () => {
  const BOX = { width: 300, height: 150, padding: 10 };
  // 서울 근처에서 동쪽으로 약 880m, 북쪽으로 약 220m 간 경로(상자보다 더 가로로 길다)
  const START = { lat: 37.5, lng: 127.0 };
  const END = { lat: 37.502, lng: 127.01 };

  it('가로세로 비율을 지킨 채 상자 안쪽에 맞춘다', () => {
    const shape = projectRoute([START, { lat: 37.501, lng: 127.004 }, END], BOX);
    expect(shape).not.toBeNull();
    if (!shape) return;

    // 가로로 긴 경로라 좌우가 안쪽 여백에 닿고, 세로는 가운데에 온다
    expect(shape.start.x).toBeCloseTo(10, 1);
    expect(shape.end.x).toBeCloseTo(290, 1);
    // 북쪽(도착)이 위
    expect(shape.end.y).toBeLessThan(shape.start.y);
    expect((shape.start.y + shape.end.y) / 2).toBeCloseTo(75, 0);
    // 1도의 길이: 위도 방향이 경도 방향보다 길다(위도 37.5도에서 약 1.26배). 그 비율이 그림에 남아야 한다
    const drawnRatio = (shape.end.x - shape.start.x) / (shape.start.y - shape.end.y);
    const realRatio = (0.01 * Math.cos((37.501 * Math.PI) / 180)) / 0.002;
    expect(drawnRatio).toBeCloseTo(realRatio, 1);
    expect(shape.path.startsWith(`M${shape.start.x.toFixed(1)} ${shape.start.y.toFixed(1)} L`)).toBe(true);
  });

  it('세로로 긴 경로는 위아래가 안쪽 여백에 닿는다', () => {
    const shape = projectRoute([START, { lat: 37.51, lng: 127.001 }], BOX);
    expect(shape?.end.y).toBeCloseTo(10, 1);
    expect(shape?.start.y).toBeCloseTo(140, 1);
  });

  it('곧게 동쪽으로만 간 경로도 그린다(세로 범위가 0)', () => {
    const shape = projectRoute([START, { lat: 37.5, lng: 127.005 }], BOX);
    expect(shape?.start).toEqual({ x: 10, y: 75 });
    expect(shape?.end.x).toBeCloseTo(290, 1);
  });

  it('점이 2개 미만이거나 제자리(20m 안)면 그리지 않는다', () => {
    expect(projectRoute([], BOX)).toBeNull();
    expect(projectRoute([START], BOX)).toBeNull();
    expect(projectRoute([START, { lat: 37.50005, lng: 127.00005 }], BOX)).toBeNull();
  });

  it('점이 아주 많으면 솎아서 그리되 처음과 끝은 남긴다', () => {
    const many = Array.from({ length: 5000 }, (_, index) => ({ lat: 37.5 + index * 0.00001, lng: 127 + index * 0.00002 }));
    const shape = projectRoute(many, BOX);
    expect(shape?.path.split(' L')).toHaveLength(200);
    const few = projectRoute([many[0], many[many.length - 1]], BOX);
    expect(shape?.start).toEqual(few?.start);
    expect(shape?.end).toEqual(few?.end);
  });
});
