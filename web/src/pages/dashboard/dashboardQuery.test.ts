import { describe, expect, it } from 'vitest';

import { parseDashboardQuery, toDashboardSearch } from './dashboardQuery';

const TODAY = '2026-11-23';

function parse(search: string) {
  return parseDashboardQuery(new URLSearchParams(search), TODAY);
}

describe('parseDashboardQuery', () => {
  it('쿼리가 없으면 이번 달 · 거리', () => {
    expect(parse('')).toEqual({ period: 'month', anchor: TODAY, metric: 'distance' });
  });

  it('주소에 적힌 값을 읽는다', () => {
    expect(parse('?period=year&anchor=2025-01-01&metric=count')).toEqual({
      period: 'year',
      anchor: '2025-01-01',
      metric: 'count',
    });
  });

  it('모르는 값은 기본값으로 본다', () => {
    expect(parse('?period=week&metric=pace&anchor=어제')).toEqual({ period: 'month', anchor: TODAY, metric: 'distance' });
  });

  it('달력에 없는 날짜와 오늘보다 뒤의 날짜는 오늘로 본다', () => {
    expect(parse('?anchor=2026-02-30').anchor).toBe(TODAY);
    expect(parse('?anchor=2026-12-01').anchor).toBe(TODAY);
    expect(parse('?anchor=2026-11-01').anchor).toBe('2026-11-01');
  });

  it('서버가 받는 가장 이른 날짜보다 앞이면 그 날짜로 본다', () => {
    expect(parse('?anchor=1999-12-31').anchor).toBe('2000-01-01');
    expect(parse('?period=year&anchor=1987-06-15').anchor).toBe('2000-01-01');
  });

  it('가장 이른 날짜와 그 바로 뒤는 그대로 읽는다', () => {
    expect(parse('?anchor=2000-01-01').anchor).toBe('2000-01-01');
    expect(parse('?anchor=2000-01-02').anchor).toBe('2000-01-02');
  });
});

describe('toDashboardSearch', () => {
  it('기본값은 적지 않는다', () => {
    expect(toDashboardSearch({ period: 'month', anchor: TODAY, metric: 'distance' }, TODAY)).toBe('');
  });

  it('오늘이 든 기간이면 기준 날짜를 적지 않는다', () => {
    expect(toDashboardSearch({ period: 'month', anchor: '2026-11-01', metric: 'time' }, TODAY)).toBe('?metric=time');
    expect(toDashboardSearch({ period: 'year', anchor: '2026-03-01', metric: 'distance' }, TODAY)).toBe('?period=year');
  });

  it('지난 기간이면 기준 날짜를 적는다', () => {
    expect(toDashboardSearch({ period: 'year', anchor: '2025-01-01', metric: 'count' }, TODAY)).toBe(
      '?period=year&anchor=2025-01-01&metric=count',
    );
  });

  it('적은 것을 다시 읽으면 같은 기간이다', () => {
    const query = { period: 'month', anchor: '2026-10-01', metric: 'count' } as const;
    expect(parse(toDashboardSearch(query, TODAY))).toEqual(query);
  });
});
