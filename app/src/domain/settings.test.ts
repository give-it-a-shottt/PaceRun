import { describe, expect, it } from 'vitest';

import { mergeSettings } from './settings';
import { DEFAULT_SETTINGS } from './types';

describe('mergeSettings', () => {
  it('저장된 값이 없으면 기본값을 돌려준다', () => {
    expect(mergeSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it('저장된 키만 덮어쓰고 나머지는 기본값으로 둔다', () => {
    const merged = mergeSettings([
      { key: 'weeklyGoal', value: '4' },
      { key: 'runTheme', value: '"light"' },
      { key: 'onboardingDone', value: 'true' },
    ]);
    expect(merged).toEqual({ ...DEFAULT_SETTINGS, weeklyGoal: 4, runTheme: 'light', onboardingDone: true });
  });

  it('객체 값(마지막 러닝 설정)도 그대로 되살린다', () => {
    const config = { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 };
    const merged = mergeSettings([{ key: 'lastRunConfig', value: JSON.stringify(config) }]);
    expect(merged.lastRunConfig).toEqual(config);
  });

  it('JSON이 깨진 값은 버리고 기본값을 쓴다', () => {
    const merged = mergeSettings([{ key: 'weeklyGoal', value: '{깨짐' }]);
    expect(merged.weeklyGoal).toBe(DEFAULT_SETTINGS.weeklyGoal);
  });

  it('모르는 키는 무시한다', () => {
    const merged = mergeSettings([{ key: 'unknownKey', value: '1' }]);
    expect(merged).toEqual(DEFAULT_SETTINGS);
    expect('unknownKey' in merged).toBe(false);
  });
});
