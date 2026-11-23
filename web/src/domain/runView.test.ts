import { describe, expect, it } from 'vitest';

import { formatDateTimeRange, formatDistanceKm, formatDuration, formatHoursMinutes, formatListDateTime, formatPace } from './format';
import { describeComparison, describeGoal, describeRunDetail, describeRunRow, previousComparable, runTitle } from './runView';
import type { RunDetail, RunSummary } from './types';

/** 그 사람이 있는 곳의 시각으로 만든 ISO 문자열(테스트가 시간대에 따라 달라지지 않게) */
const at = (month: number, day: number, hour = 7, minute = 12) => new Date(2026, month - 1, day, hour, minute).toISOString();

function run(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: 'run-1',
    mode: 'interval',
    config: { run_sec: 60, walk_sec: 90, repeats: 8 },
    plan_label: '인터벌 입문 3회차',
    started_at: at(11, 20),
    ended_at: at(11, 20, 7, 32),
    elapsed_s: 1214,
    distance_m: 3125,
    avg_pace_s_per_km: 362,
    counted: true,
    ...overrides,
  };
}

describe('표기', () => {
  it('시간 · 거리 · 페이스', () => {
    expect(formatDuration(1214)).toBe('20:14');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatHoursMinutes(15_150)).toBe('4시간 12분');
    expect(formatHoursMinutes(7200)).toBe('2시간');
    expect(formatHoursMinutes(2100)).toBe('35분');
    // 거리는 버린다(뛴 것보다 많이 보이지 않게)
    expect(formatDistanceKm(3129)).toBe('3.12');
    expect(formatPace(362.4)).toBe(`6'02"`);
    expect(formatPace(null)).toBe(`-'--"`);
  });

  it('목록의 날짜는 24시간제, 상세의 시각 범위는 오전 · 오후로 적는다', () => {
    expect(formatListDateTime(at(11, 20))).toBe('11월 20일 (금) 07:12');
    expect(formatDateTimeRange(at(11, 20), at(11, 20, 7, 32))).toBe('2026년 11월 20일 (금) 오전 7:12 – 7:32');
    // 오전에서 오후로 넘어가면 끝에도 오전 · 오후를 적는다
    expect(formatDateTimeRange(at(11, 20, 11, 50), at(11, 20, 12, 10))).toBe('2026년 11월 20일 (금) 오전 11:50 – 오후 12:10');
    // 자정을 넘기면 끝 날짜도 적는다
    expect(formatDateTimeRange(at(11, 20, 23, 50), at(11, 21, 0, 10))).toBe('2026년 11월 20일 (금) 오후 11:50 – 11월 21일 (토) 오전 12:10');
  });
});

describe('목록의 한 줄', () => {
  it('날짜 · 모드 · 제목 · 거리 · 시간 · 페이스', () => {
    expect(describeRunRow(run())).toEqual({
      id: 'run-1',
      dateText: '11월 20일 (금) 07:12',
      mode: 'interval',
      modeLabel: '인터벌',
      title: '인터벌 입문 3회차',
      distanceText: '3.12 km',
      durationText: '20:14',
      paceText: `6'02"`,
    });
  });

  it('계획 없이 뛴 러닝의 제목은 모드 이름이다', () => {
    expect(runTitle({ plan_label: null, mode: 'free' })).toBe('자유 러닝');
    expect(describeRunRow(run({ plan_label: null, avg_pace_s_per_km: null }))).toMatchObject({ title: '인터벌', paceText: `-'--"` });
  });
});

describe('모드별 목표', () => {
  it('모드마다 한 줄로 적는다', () => {
    expect(describeGoal(run())).toBe('1분 달리기 + 1분 30초 걷기 × 8');
    expect(describeGoal({ mode: 'free', config: { target_duration_sec: 600 } })).toBe('10분');
    expect(describeGoal({ mode: 'free', config: { target_duration_sec: null } })).toBe('제한 없음');
    expect(describeGoal({ mode: 'cadence', config: { spm: 170, duration_sec: 1200 } })).toBe('분당 170걸음 · 20분');
    expect(describeGoal({ mode: 'pacemaker', config: { target_pace_s_per_km: 390, distance_m: 3000 } })).toBe(`3km · 6'30"/km`);
  });

  it('모르는 모양이면 "–"로 적는다', () => {
    expect(describeGoal({ mode: 'interval', config: {} })).toBe('–');
    expect(describeGoal({ mode: 'pacemaker', config: { distance_m: 3000 } })).toBe('–');
  });
});

describe('지난번 비교', () => {
  const current = run();

  it('같은 모드의 바로 앞, 10분 이상 뛴, 페이스가 있는 기록을 고른다', () => {
    const others = [
      current,
      run({ id: 'a', started_at: at(11, 17), avg_pace_s_per_km: 370 }),
      run({ id: 'b', started_at: at(11, 10), avg_pace_s_per_km: 300 }),
      run({ id: 'c', started_at: at(11, 19), mode: 'free' }),
      run({ id: 'd', started_at: at(11, 19), counted: false }),
      run({ id: 'e', started_at: at(11, 18), avg_pace_s_per_km: null }),
      run({ id: 'f', started_at: at(11, 21), avg_pace_s_per_km: 100 }),
    ];
    expect(previousComparable(current, others)?.id).toBe('a');
    expect(previousComparable(current, [current])).toBeNull();
  });

  it('빨라졌으면 몇 초인지, 느려졌으면 그대로 말한다', () => {
    expect(describeComparison(current, run({ avg_pace_s_per_km: 370 }))).toEqual({
      text: '지난번보다 페이스가 8초 빨라졌어요',
      detail: `같은 인터벌 기준 · 6'10" → 6'02"`,
    });
    expect(describeComparison(current, run({ avg_pace_s_per_km: 300 }))?.text).toBe('지난번보다 1분 2초 천천히 뛰었어요');
    expect(describeComparison(current, run({ avg_pace_s_per_km: 362.3 }))?.text).toBe('지난번과 같은 페이스로 뛰었어요');
  });

  it('지난 기록이 없으면 첫 기록이라고 알리고, 이번 페이스를 모르면 비교하지 않는다', () => {
    expect(describeComparison(current, null)).toEqual({ text: '첫 인터벌 기록이에요', detail: null });
    expect(describeComparison(run({ avg_pace_s_per_km: null }), run())).toBeNull();
  });
});

describe('러닝 상세', () => {
  const detail: RunDetail = {
    ...run(),
    segments: [
      { idx: 0, kind: 'run', started_elapsed_s: 0, duration_s: 60, distance_m: 177.5 },
      { idx: 1, kind: 'walk', started_elapsed_s: 60, duration_s: 90, distance_m: 163 },
      { idx: 2, kind: 'km', started_elapsed_s: 150, duration_s: 372, distance_m: 1000 },
      { idx: 3, kind: 'km', started_elapsed_s: 522, duration_s: 150, distance_m: 420 },
      { idx: 4, kind: 'walk', started_elapsed_s: 672, duration_s: 90, distance_m: 4 },
    ],
    route: [
      [37.5, 127, 0],
      [37.501, 127.001, 60],
    ],
  };

  it('제목 · 시각 · 지표 · 구간 표 · 경로', () => {
    const view = describeRunDetail(detail, run({ id: 'prev', avg_pace_s_per_km: 370 }));
    expect(view).toMatchObject({
      breadcrumb: '11월 20일 러닝',
      modeLabel: '인터벌',
      title: '인터벌 입문 3회차',
      timeText: '2026년 11월 20일 (금) 오전 7:12 – 7:32',
      goalText: '목표 · 1분 달리기 + 1분 30초 걷기 × 8',
      note: null,
      path: [
        [37.5, 127],
        [37.501, 127.001],
      ],
    });
    expect(view.stats).toEqual([
      { label: '거리', value: '3.12 km' },
      { label: '시간', value: '20:14' },
      { label: '평균 페이스', value: `6'02"/km` },
    ]);
    expect(view.segments).toEqual([
      { no: 1, kindText: '달리기', resting: false, durationText: '1:00', paceText: `5'38"` },
      { no: 2, kindText: '걷기', resting: true, durationText: '1:30', paceText: `9'12"` },
      { no: 3, kindText: '1km', resting: false, durationText: '6:12', paceText: `6'12"` },
      { no: 4, kindText: '0.42km', resting: false, durationText: '2:30', paceText: `5'57"` },
      { no: 5, kindText: '걷기', resting: true, durationText: '1:30', paceText: `-'--"` },
    ]);
    expect(view.comparison?.text).toBe('지난번보다 페이스가 8초 빨라졌어요');
  });

  it('지난 기록을 아직 찾는 중이면 비교 상자를 그리지 않는다', () => {
    expect(describeRunDetail(detail, 'loading').comparison).toBeNull();
    expect(describeRunDetail(detail, null).comparison?.text).toBe('첫 인터벌 기록이에요');
  });

  it('10분을 못 채웠으면 알리고, 경로가 없으면 빈 경로다', () => {
    const view = describeRunDetail({ ...detail, counted: false, route: [[37.5, 127, 0]], segments: [] }, null);
    expect(view.note).toBe('10분을 채우지 못해 횟수에는 들어가지 않았어요');
    expect(view.path).toEqual([]);
    expect(view.segments).toEqual([]);
  });
});
