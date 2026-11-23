import { describe, expect, it } from 'vitest';

import { describeDashboard, isCurrentPeriod, shiftAnchor, toDateText } from './dashboard';
import type { Stats, StatsBucket } from './types';

function monthStats(overrides: Partial<Stats> = {}, days: Record<number, Partial<StatsBucket>> = {}): Stats {
  const buckets: StatsBucket[] = Array.from({ length: 30 }, (_, index) => ({
    label: String(index + 1),
    start: `2026-11-${String(index + 1).padStart(2, '0')}`,
    distance_m: 0,
    count: 0,
    elapsed_s: 0,
    ...days[index + 1],
  }));
  const totals = buckets.reduce(
    (sum, bucket) => ({
      distance_m: sum.distance_m + bucket.distance_m,
      count: sum.count + bucket.count,
      elapsed_s: sum.elapsed_s + bucket.elapsed_s,
    }),
    { distance_m: 0, count: 0, elapsed_s: 0 },
  );
  return {
    period: 'month',
    start: '2026-11-01',
    end: '2026-12-01',
    buckets,
    totals,
    goal_weeks: { achieved: 3, total: 4 },
    weekly_goal: 3,
    ...overrides,
  };
}

const TODAY = '2026-11-23';
const NOVEMBER = monthStats({}, {
  2: { distance_m: 3000, count: 1, elapsed_s: 1200 },
  20: { distance_m: 3120, count: 1, elapsed_s: 1214 },
  21: { distance_m: 30, count: 0, elapsed_s: 20 },
});

describe('기간 옮기기', () => {
  it('앞 · 뒤 달로 옮기면 그 달의 첫날이다(해 넘김 포함)', () => {
    expect(shiftAnchor('month', '2026-11-23', -1)).toBe('2026-10-01');
    expect(shiftAnchor('month', '2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-01');
    // 3월 31일에서 한 달 앞은 2월이다(2월 31일로 넘어가 3월이 되지 않는다)
    expect(shiftAnchor('month', '2026-03-31', -1)).toBe('2026-02-01');
  });

  it('앞 · 뒤 해로 옮기면 그 해의 1월 1일이다', () => {
    expect(shiftAnchor('year', '2026-11-23', -1)).toBe('2025-01-01');
    expect(shiftAnchor('year', '2026-11-23', 1)).toBe('2027-01-01');
  });

  it('오늘이 든 기간인지 안다', () => {
    expect(isCurrentPeriod('month', '2026-11-01', TODAY)).toBe(true);
    expect(isCurrentPeriod('month', '2026-10-01', TODAY)).toBe(false);
    expect(isCurrentPeriod('month', '2025-11-01', TODAY)).toBe(false);
    expect(isCurrentPeriod('year', '2026-01-01', TODAY)).toBe(true);
    expect(isCurrentPeriod('year', '2025-01-01', TODAY)).toBe(false);
  });

  it('날짜를 그 사람이 있는 곳의 날짜로 적는다', () => {
    expect(toDateText(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('대시보드에 그릴 값 — 월', () => {
  const view = describeDashboard({ stats: NOVEMBER, previous: null, metric: 'distance', today: TODAY });

  it('제목과 차트 제목', () => {
    expect(view.eyebrow).toBe('2026년');
    expect(view.title).toBe('11월 기록');
    expect(view.chartTitle).toBe('일별 거리 (km)');
  });

  it('날마다 막대 하나, 값은 km 소수 한 자리. 뛰지 않은 날은 값을 적지 않는다', () => {
    expect(view.bars).toHaveLength(30);
    expect(view.bars[1]).toMatchObject({ name: '11월 2일', value: 3, valueText: '3' });
    expect(view.bars[19]).toMatchObject({ value: 3.12, valueText: '3.1' });
    expect(view.bars[0].valueText).toBeNull();
    // "0.0"으로 보일 만큼 짧은 날도 적지 않는다
    expect(view.bars[20].valueText).toBeNull();
  });

  it('차트를 글로 읽어 주는 한 줄은 값이 있는 날만 담는다', () => {
    expect(view.chartSummary).toBe('일별 거리 (km), 11월 2일 3, 11월 20일 3.1');
  });

  it('가로 눈금은 1일과 5의 배수만 적는다', () => {
    expect(view.bars.filter((bar) => bar.axisLabel).map((bar) => bar.axisLabel)).toEqual(['1', '5', '10', '15', '20', '25', '30']);
  });

  it('합계: 거리 · 횟수 · 시간', () => {
    expect(view.totalsTitle).toBe('이번 달');
    expect(view.totals).toEqual([
      { label: '거리', value: '6.2 km' },
      { label: '횟수', value: '2회' },
      { label: '시간', value: '40분' },
    ]);
    expect(view.goalWeeksText).toBe('이 기간 4주 가운데 3주 달성');
    expect(view.isEmpty).toBe(false);
  });

  it('지난 달을 보면 합계 제목에 달을 적는다', () => {
    const october = monthStats({ start: '2026-10-01', end: '2026-11-01' });
    expect(describeDashboard({ stats: october, previous: null, metric: 'distance', today: TODAY }).totalsTitle).toBe('10월 합계');
  });

  it('횟수 · 시간으로 바꾸면 값과 제목이 바뀐다', () => {
    const count = describeDashboard({ stats: NOVEMBER, previous: null, metric: 'count', today: TODAY });
    expect(count.chartTitle).toBe('일별 횟수 (회)');
    expect(count.bars[1]).toMatchObject({ value: 1, valueText: '1' });
    // 10분을 못 채운 날은 횟수가 0이다
    expect(count.bars[20].valueText).toBeNull();

    const time = describeDashboard({ stats: NOVEMBER, previous: null, metric: 'time', today: TODAY });
    expect(time.chartTitle).toBe('일별 시간 (분)');
    expect(time.bars[1]).toMatchObject({ value: 20, valueText: '20' });
  });
});

describe('평균 페이스와 지난 기간 비교', () => {
  const pace = (previous: Stats | null, stats: Stats = NOVEMBER) =>
    describeDashboard({ stats, previous, metric: 'distance', today: TODAY });

  it('합계 시간 ÷ 합계 거리로 낸다', () => {
    // 2434초 ÷ 6.15km = 395.8초
    expect(pace(null).paceText).toBe(`6'36"/km`);
  });

  it('지난달보다 빨라졌으면 몇 초인지 알린다', () => {
    const october = monthStats({ start: '2026-10-01' }, { 3: { distance_m: 3000, count: 1, elapsed_s: 1230 } });
    const view = pace(october);
    expect(view.paceNote).toBe('지난달보다 14초 빨라졌어요');
    expect(view.paceTrend).toBe('faster');
  });

  it('느려졌거나 같으면 그대로 말한다', () => {
    const faster = monthStats({ start: '2026-10-01' }, { 3: { distance_m: 3000, count: 1, elapsed_s: 900 } });
    expect(pace(faster)).toMatchObject({ paceNote: '지난달보다 1분 36초 느려졌어요', paceTrend: 'slower' });

    const same = monthStats({ start: '2026-10-01' }, { 3: { distance_m: 6150, count: 1, elapsed_s: 2434 } });
    expect(pace(same)).toMatchObject({ paceNote: '지난달과 같은 페이스예요', paceTrend: null });
  });

  it('지난달에 기록이 없으면 비교하지 않았다고 알린다', () => {
    expect(pace(monthStats({ start: '2026-10-01' }))).toMatchObject({
      paceNote: '지난달 기록이 없어 비교하지 않았어요',
      paceTrend: null,
    });
  });

  it('지난달을 아직 받지 못했으면 비교 문구를 비워 둔다', () => {
    expect(pace(null).paceNote).toBe('');
  });

  it('이 기간에 기록이 없으면 페이스를 내지 않는다', () => {
    const view = pace(null, monthStats());
    expect(view.paceText).toBe(`-'--"/km`);
    expect(view.paceNote).toBe('이 기간에는 기록이 없어요');
    expect(view.isEmpty).toBe(true);
  });
});

describe('대시보드에 그릴 값 — 년', () => {
  const months: StatsBucket[] = Array.from({ length: 12 }, (_, index) => ({
    label: `${index + 1}월`,
    start: `2026-${String(index + 1).padStart(2, '0')}-01`,
    distance_m: index === 10 ? 32_400 : 0,
    count: index === 10 ? 12 : 0,
    elapsed_s: index === 10 ? 15_150 : 0,
  }));
  const year: Stats = {
    period: 'year',
    start: '2026-01-01',
    end: '2027-01-01',
    buckets: months,
    totals: { distance_m: 32_400, count: 12, elapsed_s: 15_150 },
    goal_weeks: { achieved: 20, total: 47 },
    weekly_goal: 3,
  };
  const view = describeDashboard({ stats: year, previous: { ...year, totals: { distance_m: 10_000, count: 4, elapsed_s: 4800 } }, metric: 'distance', today: TODAY });

  it('제목 · 눈금 · 합계가 해 단위다', () => {
    expect(view.eyebrow).toBe('');
    expect(view.title).toBe('2026년 기록');
    expect(view.chartTitle).toBe('월별 거리 (km)');
    expect(view.bars.map((bar) => bar.axisLabel)).toEqual(months.map((month) => month.label));
    expect(view.bars[10]).toMatchObject({ name: '11월', valueText: '32.4' });
    expect(view.totalsTitle).toBe('올해');
    expect(view.totals[2]).toEqual({ label: '시간', value: '4시간 12분' });
  });

  it('비교는 지난해와 한다', () => {
    // 올해 467.6초, 지난해 480초
    expect(view.paceNote).toBe('지난해보다 12초 빨라졌어요');
  });
});
