import { describe, expect, it } from 'vitest';

import { applyLocation, pause, startRun, tick, type RunState } from './runEngine';
import { describeRun } from './runView';
import type { RunConfig } from './types';

const T0 = 1_700_000_000_000;
const OPTIONS = { voiceIntervalKm: 1 };

function start(config: RunConfig, planLabel: string | null = null): RunState {
  return startRun({ runId: 'run-1', config, planLabel, now: T0 }).state;
}

describe('describeRun', () => {
  it('제목은 계획 이름이 있으면 그것을, 없으면 모드 이름을 쓴다', () => {
    expect(describeRun(start({ mode: 'free', targetDurationSec: null }), T0).title).toBe('자유 러닝');
    expect(describeRun(start({ mode: 'free', targetDurationSec: 600 }, '10분만 뛰기'), T0).title).toBe('10분만 뛰기');
  });

  it('시간 제한 없는 자유 러닝은 경과 시간을 크게 보여 주고, 1회 인정까지 남은 시간을 알려 준다', () => {
    const view = describeRun(start({ mode: 'free', targetDurationSec: null }), T0 + 342_000);
    expect(view).toMatchObject({
      elapsedText: '경과 5:42',
      primaryLabel: '경과 시간',
      primaryValue: '5:42',
      secondaryText: '1회 인정까지 4:18',
    });
  });

  it('목표 시간이 있으면 남은 시간을 크게 보여 주고, 넘기면 경과 시간으로 바꾼다', () => {
    const state = start({ mode: 'free', targetDurationSec: 600 });

    expect(describeRun(state, T0 + 342_000)).toMatchObject({
      primaryLabel: '자유 러닝 · 남은 시간',
      primaryValue: '4:18',
      secondaryText: '목표 10:00',
    });
    expect(describeRun(state, T0 + 615_000)).toMatchObject({
      primaryLabel: '목표를 채웠어요 · 경과 시간',
      primaryValue: '10:15',
      secondaryText: '오늘 1회 인정 완료',
    });
  });

  it('거리와 평균 페이스를 표기 규칙대로 만든다. 거리가 짧으면 페이스는 비워 둔다', () => {
    let state = start({ mode: 'free', targetDurationSec: null });
    expect(describeRun(state, T0 + 5000)).toMatchObject({ distanceText: '0.00 km', paceText: `-'--"/km` });

    // 북쪽으로 초속 약 3m씩 100초
    for (let sec = 0; sec <= 100; sec++) {
      state = applyLocation(state, { t: T0 + sec * 1000, lat: 37.5 + (sec * 3) / 111_194.9, lng: 127, accuracy: 5 }).state;
    }
    const view = describeRun(state, T0 + 100_000);
    expect(view.distanceText).toBe('0.30 km');
    expect(view.paceText).toBe(`5'33"/km`);
  });

  it('GPS가 끊기면 지표 설명 줄이 바뀌고 최근 안내에 끊김 문구가 온다', () => {
    const lost = tick(start({ mode: 'free', targetDurationSec: null }), T0 + 25_000, OPTIONS).state;
    const view = describeRun(lost, T0 + 25_000);

    expect(view.gpsLost).toBe(true);
    expect(view.distanceCaption).toBe('거리 · GPS 찾는 중');
    expect(view.paceCaption).toBe('평균 페이스 · 잠시 멈춤');
    expect(view.lastCue).toBe('GPS 신호를 찾는 중이에요');
    // 타이머는 계속 간다
    expect(view.primaryValue).toBe('0:25');
  });

  it('일시정지 중에는 숫자가 멈춘다', () => {
    const paused = pause(start({ mode: 'free', targetDurationSec: null }), T0 + 60_000).state;
    const view = describeRun(paused, T0 + 300_000);

    expect(view.paused).toBe(true);
    expect(view.primaryValue).toBe('1:00');
    expect(view.lastCue).toBe('일시정지');
  });
});
