import { describe, expect, it } from 'vitest';

import type { RunConfig } from './types';

import { configFields, NO_TIME_LIMIT_TEXT } from './configFields';

function only(config: RunConfig) {
  const fields = configFields(config);
  expect(fields).toHaveLength(1);
  return fields[0];
}

describe('configFields', () => {
  it('자유 러닝 시간은 5분씩 바뀐다(초로 저장)', () => {
    const field = only({ mode: 'free', targetDurationSec: 20 * 60 });
    expect(field.valueText).toBe('20분');
    expect(field.decreased).toEqual({ mode: 'free', targetDurationSec: 15 * 60 });
    expect(field.increased).toEqual({ mode: 'free', targetDurationSec: 25 * 60 });
  });

  it('자유 러닝은 가장 짧은 시간 아래가 제한 없음이고, 가장 긴 시간에서 더 늘릴 수 없다', () => {
    expect(only({ mode: 'free', targetDurationSec: 10 * 60 }).decreased).toEqual({ mode: 'free', targetDurationSec: null });
    expect(only({ mode: 'free', targetDurationSec: 120 * 60 }).increased).toBeNull();

    const unlimited = only({ mode: 'free', targetDurationSec: null });
    expect(unlimited.valueText).toBe(NO_TIME_LIMIT_TEXT);
    expect(unlimited.decreased).toBeNull();
    expect(unlimited.increased).toEqual({ mode: 'free', targetDurationSec: 10 * 60 });
  });

  it('인터벌은 범위 끝에서 멈추고 다른 값은 건드리지 않는다', () => {
    const [run, walk, repeats] = configFields({ mode: 'interval', runSec: 30, walkSec: 600, repeats: 8 });
    expect(run.decreased).toBeNull();
    expect(run.increased).toEqual({ mode: 'interval', runSec: 60, walkSec: 600, repeats: 8 });
    expect(walk.increased).toBeNull();
    expect(walk.decreased).toEqual({ mode: 'interval', runSec: 30, walkSec: 570, repeats: 8 });
    expect(repeats.valueText).toBe('8회');
    expect(repeats.increased).toEqual({ mode: 'interval', runSec: 30, walkSec: 600, repeats: 9 });
  });

  it('칸에 맞지 않거나 범위를 벗어난 값은 가까운 칸으로 맞춘다', () => {
    const [run] = configFields({ mode: 'interval', runSec: 45, walkSec: 90, repeats: 8 });
    expect(run.decreased).toMatchObject({ runSec: 30 });
    expect(run.increased).toMatchObject({ runSec: 60 });

    const [spm] = configFields({ mode: 'cadence', spm: 200, durationSec: 1200 });
    expect(spm.increased).toBeNull();
    expect(spm.decreased).toMatchObject({ spm: 190 });
  });

  it('페이스메이커 거리는 1km씩 바뀐다(미터로 저장)', () => {
    const [pace, distance] = configFields({ mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 });
    expect(pace.valueText).toBe(`6'30"/km`);
    expect(pace.increased).toMatchObject({ targetPaceSecPerKm: 400 });
    expect(distance.valueText).toBe('3km');
    expect(distance.decreased).toMatchObject({ distanceM: 2000 });
    expect(distance.increased).toMatchObject({ distanceM: 4000 });
  });
});
