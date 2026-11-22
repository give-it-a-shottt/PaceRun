import { describe, expect, it } from 'vitest';

import { parsePlanRows } from './planRows';

describe('DB에서 읽은 계획 줄', () => {
  const INTERVAL_JSON = JSON.stringify({ mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 });
  const row = (overrides: object = {}) => ({ weekday: 0, mode: 'interval', config_json: INTERVAL_JSON, label: '인터벌 입문', ...overrides });

  it('정상인 줄은 계획으로 바꾸고 요일 순으로 놓는다', () => {
    const items = parsePlanRows([row({ weekday: 5 }), row({ weekday: 0 })]);
    expect(items.map((planned) => planned.weekday)).toEqual([0, 5]);
    expect(items[0]).toEqual({
      weekday: 0,
      mode: 'interval',
      config: { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 },
      label: '인터벌 입문',
    });
  });

  it('쓸 수 없는 줄은 건너뛰고 나머지는 살린다', () => {
    const items = parsePlanRows([
      row({ weekday: 0 }),
      row({ weekday: 1, config_json: '{깨진 JSON' }),
      row({ weekday: 2, config_json: JSON.stringify({ mode: 'interval', runSec: 60 }) }), // 칸이 모자람
      row({ weekday: 3, mode: 'cadence' }), // 모드와 목표값이 어긋남
      row({ weekday: 7 }), // 없는 요일
      row({ weekday: -1 }),
      row({ weekday: 2.5 }),
      row({ weekday: 6 }),
    ]);
    expect(items.map((planned) => planned.weekday)).toEqual([0, 6]);
  });

  it('줄이 없으면 빈 계획이다', () => {
    expect(parsePlanRows([])).toEqual([]);
  });
});
