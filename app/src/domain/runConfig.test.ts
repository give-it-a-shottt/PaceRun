import { describe, expect, it } from 'vitest';

import {
  defaultConfigFor,
  describeConfig,
  describeEstimate,
  estimatedDurationSec,
  nearestCadence,
  QUICK_RUN_CONFIG,
} from './runConfig';
import { isRunConfig } from './settings';
import { RUN_MODES } from './types';

describe('defaultConfigFor', () => {
  it('모든 모드의 기본값이 저장 · 복원 검사를 통과한다', () => {
    for (const mode of RUN_MODES) {
      expect(isRunConfig(defaultConfigFor(mode, 170))).toBe(true);
    }
    expect(isRunConfig(QUICK_RUN_CONFIG)).toBe(true);
  });

  it('인터벌 기본값은 1분 달리기 + 1분 30초 걷기 × 8이다', () => {
    expect(defaultConfigFor('interval', 170)).toEqual({ mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 });
  });

  it('케이던스 기본값은 설정의 기본 걸음 수를 소리 파일이 있는 값으로 맞춰 쓴다', () => {
    expect(defaultConfigFor('cadence', 172)).toMatchObject({ spm: 170 });
    expect(defaultConfigFor('cadence', 220)).toMatchObject({ spm: 190 });
    expect(defaultConfigFor('cadence', 120)).toMatchObject({ spm: 150 });
  });
});

describe('nearestCadence', () => {
  it('5 단위로 맞추고 150~190을 벗어나지 않는다', () => {
    expect(nearestCadence(173)).toBe(175);
    expect(nearestCadence(167)).toBe(165);
    expect(nearestCadence(100)).toBe(150);
    expect(nearestCadence(300)).toBe(190);
  });
});

describe('describeConfig · describeEstimate', () => {
  it('인터벌', () => {
    const config = defaultConfigFor('interval', 170);
    expect(describeConfig(config)).toBe('1분 달리기 + 1분 30초 걷기 × 8');
    expect(estimatedDurationSec(config)).toBe(1200);
    expect(describeEstimate(config)).toBe('약 20분');
  });

  it('케이던스', () => {
    expect(describeConfig({ mode: 'cadence', spm: 170, durationSec: 1200 })).toBe('20분 · 분당 170걸음');
  });

  it('페이스메이커', () => {
    const config = { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 } as const;
    expect(describeConfig(config)).toBe(`3km · 목표 6'30"/km`);
    expect(describeEstimate(config)).toBe('약 20분');
  });

  it('자유 러닝은 시간 제한이 없으면 예상 시간을 내지 않는다', () => {
    expect(describeConfig({ mode: 'free', targetDurationSec: null })).toBe('시간 제한 없이');
    expect(describeEstimate({ mode: 'free', targetDurationSec: null })).toBeNull();
    expect(describeConfig(QUICK_RUN_CONFIG)).toBe('10분 동안');
  });
});
