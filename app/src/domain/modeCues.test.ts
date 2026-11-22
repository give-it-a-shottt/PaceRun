import { describe, expect, it } from 'vitest';

import { buildIntervalSteps, intervalPositionAt } from './interval';
import { applyLocation, finish, pause, resume, startRun, tick, type RunState } from './runEngine';
import { describeRun } from './runView';
import type { RunConfig } from './types';

const T0 = 1_700_000_000_000;
const OPTIONS = { voiceIntervalKm: 1 };
const DEG_PER_M = 1 / 111_194.9;
const INTERVAL = { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 } as const;

function start(config: RunConfig, planLabel: string | null = null): RunState {
  return startRun({ runId: 'run-1', config, planLabel, now: T0 }).state;
}

/** fromSec부터 toSec까지 1초마다, 초속 speedMps로 움직이는 위치를 넣고 계산한다. 그동안 나온 안내를 모아 돌려준다. */
function run(state: RunState, fromSec: number, toSec: number, speedMps: number, fromM = 0) {
  let next = state;
  const speeches: string[] = [];
  for (let sec = fromSec; sec <= toSec; sec++) {
    const meters = fromM + (sec - fromSec) * speedMps;
    next = applyLocation(next, { t: T0 + sec * 1000, lat: 37.5 + meters * DEG_PER_M, lng: 127, accuracy: 5 }).state;
    const stepped = tick(next, T0 + sec * 1000, OPTIONS);
    next = stepped.state;
    speeches.push(...stepped.cues.map((cue) => cue.speech));
  }
  return { state: next, speeches, meters: fromM + (toSec - fromSec) * speedMps };
}

/** 위치를 넣지 않은 테스트에서는 "GPS 신호가 약해요" 안내가 함께 나온다. 모드 안내만 볼 때 걸러 낸다. */
function modeSpeeches(cues: { speech: string }[]): string[] {
  return cues.map((cue) => cue.speech).filter((speech) => !speech.startsWith('GPS'));
}

describe('인터벌 일정', () => {
  it('1분 달리기 + 1분 30초 걷기 × 8은 구간 16개, 20분이다', () => {
    const steps = buildIntervalSteps(INTERVAL);
    expect(steps).toHaveLength(16);
    expect(steps[0]).toEqual({ idx: 0, kind: 'run', startMs: 0, durationMs: 60_000 });
    expect(steps[1]).toEqual({ idx: 1, kind: 'walk', startMs: 60_000, durationMs: 90_000 });
    expect(steps[15]).toMatchObject({ kind: 'walk', startMs: 1_110_000 });
    expect(steps.reduce((sum, step) => sum + step.durationMs, 0)).toBe(1_200_000);
  });

  it('경과 5분 42초는 5번째 구간(달리기)이고 18초가 남았다', () => {
    const position = intervalPositionAt(INTERVAL, 342_000);
    expect(position.step).toMatchObject({ idx: 4, kind: 'run' });
    expect(position.remainingMs).toBe(18_000);
    expect(position.next).toMatchObject({ idx: 5, kind: 'walk', durationMs: 90_000 });
    expect(position.progress).toBeCloseTo(0.7, 5);
  });

  it('구간이 바뀌는 순간은 다음 구간에 속한다', () => {
    expect(intervalPositionAt(INTERVAL, 59_999).step?.kind).toBe('run');
    expect(intervalPositionAt(INTERVAL, 60_000).step).toMatchObject({ idx: 1, kind: 'walk' });
    expect(intervalPositionAt(INTERVAL, 150_000).step).toMatchObject({ idx: 2, kind: 'run' });
  });

  it('마지막 구간에는 다음이 없고, 일정을 마치면 구간이 없다', () => {
    expect(intervalPositionAt(INTERVAL, 1_199_000).next).toBeNull();
    expect(intervalPositionAt(INTERVAL, 1_200_000)).toMatchObject({ step: null, next: null, total: 16 });
  });
});

describe('인터벌 안내', () => {
  it('구간이 시작될 때와 끝나기 10초 전에 말한다', () => {
    const { speeches } = run(start(INTERVAL), 0, 155, 3);
    expect(speeches).toEqual([
      '달리기. 1분', // 0초 (시작 안내 "시작합니다"는 startRun이 따로 낸다)
      '10초 뒤 걷기', // 50초
      '걷기. 1분 30초', // 60초
      '10초 뒤 달리기', // 140초
      '달리기. 1분', // 150초
    ]);
  });

  it('타이머가 늦게 불려 구간을 건너뛰어도, 지나간 안내를 몰아서 말하지 않고 지금 구간만 말한다', () => {
    const state = start(INTERVAL);
    // 시작 뒤 한 번도 계산되지 않다가 5분 20초에 처음 불림(5번째 구간, 40초 남음)
    const stepped = tick(state, T0 + 320_000, OPTIONS);
    expect(modeSpeeches(stepped.cues)).toEqual(['달리기. 1분']);
  });

  it('마지막 구간은 "10초 뒤 끝나요"라고 예고하고, 다 마치면 한 번 알린다', () => {
    let state = start(INTERVAL);
    const warn = tick(state, T0 + 1_191_000, OPTIONS);
    expect(warn.cues.map((c) => c.speech)).toContain('10초 뒤 끝나요');
    state = warn.state;

    const done = tick(state, T0 + 1_200_000, OPTIONS);
    expect(done.cues.map((c) => c.speech)).toEqual(['인터벌을 모두 마쳤어요. 수고했어요']);
    expect(tick(done.state, T0 + 1_201_000, OPTIONS).cues).toEqual([]);
  });

  it('구간 막바지에 처음 불리면 "10초 뒤" 예고를 하지 않는다(이미 틀린 말이다)', () => {
    // 첫 달리기(60초)의 59초 지점에 처음 불림: 1초 남음
    const late = tick(start(INTERVAL), T0 + 59_000, OPTIONS);
    expect(modeSpeeches(late.cues)).toEqual(['달리기. 1분']);
    // 다음 구간이 시작되면 그 안내가 나온다
    expect(modeSpeeches(tick(late.state, T0 + 60_000, OPTIONS).cues)).toEqual(['걷기. 1분 30초']);
  });

  it('예고할 때를 2~3초 넘긴 정도면 예고한다', () => {
    const state = tick(start(INTERVAL), T0 + 40_000, OPTIONS).state;
    // 50초(10초 전)에 불리지 못하고 53초에 불림
    expect(modeSpeeches(tick(state, T0 + 53_000, OPTIONS).cues)).toEqual(['10초 뒤 걷기']);
  });

  it('일시정지가 구간 경계를 걸쳐도 같은 안내를 다시 말하지 않고 구간 기록이 이어진다', () => {
    // 첫 달리기 55초 지점에서 멈췄다가 5분 뒤 재개
    let state = run(start(INTERVAL), 0, 55, 3).state;
    state = pause(state, T0 + 55_000).state;
    const resumed = resume(state, T0 + 355_000);
    state = resumed.state;

    // 재개 직후: 아직 첫 구간(5초 남음). 시작 안내 · 10초 전 예고는 이미 했으므로 다시 나오지 않는다
    expect(modeSpeeches(tick(state, T0 + 356_000, OPTIONS).cues)).toEqual([]);
    // 5초 뒤 걷기 구간으로 넘어간다
    const next = tick(state, T0 + 360_000, OPTIONS);
    expect(modeSpeeches(next.cues)).toEqual(['걷기. 1분 30초']);
    expect(next.state.segments).toHaveLength(1);
    expect(next.state.segments[0]).toMatchObject({ idx: 0, kind: 'run', startedElapsedMs: 0, durationMs: 60_000 });
    expect(next.state.openSegment).toMatchObject({ idx: 1, kind: 'walk', startedElapsedMs: 60_000 });
  });

  it('일정을 마친 뒤 더 뛰면 그 뒤에 지난 km 지점만 말한다', () => {
    // 30초 달리기 + 30초 걷기 × 1, 초속 5m: 마칠 때 300m. 1km 지점은 200초
    const short = { mode: 'interval', runSec: 30, walkSec: 30, repeats: 1 } as const;
    const { speeches } = run(start(short), 0, 205, 5);
    expect(speeches).toEqual([
      '달리기. 30초',
      '10초 뒤 걷기',
      '걷기. 30초',
      '10초 뒤 끝나요',
      '인터벌을 모두 마쳤어요. 수고했어요',
      '1킬로미터. 평균 페이스 3분 20초',
    ]);
  });

  it('인터벌 중에 지나온 km 지점은 마친 뒤에 뒤늦게 말하지 않는다', () => {
    // 초속 5m로 20분 인터벌: 마칠 때 6km. 마친 직후에는 완료 안내만 나온다
    const { speeches } = run(start(INTERVAL), 1195, 1205, 5, 5975);
    expect(speeches.filter((s) => s.includes('킬로미터'))).toEqual([]);
    expect(speeches).toContain('인터벌을 모두 마쳤어요. 수고했어요');
  });

  it('목표값이 0이어도 오류 없이 바로 마친 것으로 본다', () => {
    const empty = { mode: 'interval', runSec: 0, walkSec: 0, repeats: 0 } as const;
    expect(intervalPositionAt(empty, 0)).toMatchObject({ step: null, total: 0 });
    expect(buildIntervalSteps(empty)).toEqual([]);
    expect(() => tick(start(empty), T0 + 1_000, OPTIONS)).not.toThrow();
    expect(describeRun(start(empty), T0 + 1_000).lane).toMatchObject({ currentIndex: 0, countText: '0 / 0 구간' });
  });

  it('달리기만 0초여도 걷기 구간으로 바로 넘어가고 멈추지 않는다', () => {
    const walkOnly = { mode: 'interval', runSec: 0, walkSec: 30, repeats: 2 } as const;
    expect(intervalPositionAt(walkOnly, 0).step).toMatchObject({ idx: 1, kind: 'walk' });
    expect(intervalPositionAt(walkOnly, 30_000).step).toMatchObject({ idx: 3, kind: 'walk' });
    expect(intervalPositionAt(walkOnly, 60_000).step).toBeNull();
    expect(() => run(start(walkOnly), 0, 65, 3)).not.toThrow();
  });

  it('다른 모드도 목표값이 0이면 오류 없이 바로 채운 것으로 본다', () => {
    const cadence = tick(start({ mode: 'cadence', spm: 170, durationSec: 0 }), T0 + 1_000, OPTIONS);
    expect(modeSpeeches(cadence.cues)).toEqual(['목표 시간을 채웠어요']);
    expect(describeRun(cadence.state, T0 + 1_000).primaryLabel).toBe('목표를 채웠어요 · 경과 시간');

    const pacemaker = tick(start({ mode: 'pacemaker', targetPaceSecPerKm: 400, distanceM: 0 }), T0 + 1_000, OPTIONS);
    expect(modeSpeeches(pacemaker.cues)).toEqual(['목표 거리를 채웠어요']);
    expect(describeRun(pacemaker.state, T0 + 1_000).primaryLabel).toBe('목표 거리를 채웠어요 · 경과 시간');
  });

  it('20초보다 짧은 구간은 10초 전 예고를 하지 않는다(시작 안내와 겹친다)', () => {
    const { speeches } = run(start({ mode: 'interval', runSec: 15, walkSec: 15, repeats: 2 }), 0, 29, 3);
    expect(speeches).toEqual(['달리기. 15초', '걷기. 15초']);
  });

  it('일시정지한 시간은 구간에 넣지 않는다', () => {
    let state = run(start(INTERVAL), 0, 30, 3).state;
    state = pause(state, T0 + 30_000).state;
    state = resume(state, T0 + 330_000).state;
    // 5분 멈췄다 재개: 아직 첫 달리기 구간의 30초 지점이다
    const view = describeRun(state, T0 + 330_000);
    expect(view.primaryLabel).toBe('달리기 · 남은 시간');
    expect(view.primaryValue).toBe('0:30');
  });

  it('일시정지 화면에는 어떤 구간에서 멈췄는지 알려 준다', () => {
    const paused = pause(run(start(INTERVAL), 0, 70, 3).state, T0 + 70_000).state;
    expect(describeRun(paused, T0 + 100_000).pausedText).toBe('걷기 구간이 남았어요. 기록은 계속 저장되고 있어요.');

    const free = pause(start({ mode: 'free', targetDurationSec: null }), T0 + 70_000).state;
    expect(describeRun(free, T0 + 100_000).pausedText).toBe('기록은 계속 저장되고 있어요.');
  });
});

describe('인터벌 구간 기록', () => {
  it('구간이 끝날 때마다 달리기 · 걷기 구간과 그동안 뛴 거리를 남긴다', () => {
    const { state } = run(start(INTERVAL), 0, 155, 3);
    expect(state.segments).toHaveLength(2);
    expect(state.segments[0]).toMatchObject({ idx: 0, kind: 'run', startedElapsedMs: 0, durationMs: 60_000 });
    expect(state.segments[0].distanceM).toBeCloseTo(180, 0);
    expect(state.segments[1]).toMatchObject({ idx: 1, kind: 'walk', startedElapsedMs: 60_000, durationMs: 90_000 });
    expect(state.segments[1].distanceM).toBeCloseTo(270, 0);
    expect(state.openSegment).toMatchObject({ idx: 2, kind: 'run', startedElapsedMs: 150_000 });
  });

  it('끝낼 때 열려 있던 구간까지 담는다', () => {
    const { state } = run(start(INTERVAL), 0, 155, 3);
    const summary = finish(state, T0 + 155_000);
    expect(summary.segments.map((s) => s.kind)).toEqual(['run', 'walk', 'run']);
    expect(summary.segments[2]).toMatchObject({ idx: 2, durationMs: 5_000 });
  });

  it('구간을 여러 개 건너뛰었으면 건너뛴 구간도 빠짐없이 남긴다', () => {
    const stepped = tick(start(INTERVAL), T0 + 320_000, OPTIONS);
    expect(stepped.state.segments.map((s) => [s.idx, s.kind, s.durationMs])).toEqual([
      [0, 'run', 60_000],
      [1, 'walk', 90_000],
      [2, 'run', 60_000],
      [3, 'walk', 90_000],
    ]);
    expect(stepped.state.openSegment).toMatchObject({ idx: 4, kind: 'run', startedElapsedMs: 300_000 });
  });

  it('일정을 마친 뒤 더 뛰면 1km 구간으로 이어 기록한다', () => {
    const short = { mode: 'interval', runSec: 30, walkSec: 30, repeats: 1 } as const;
    const { state } = run(start(short), 0, 70, 3);
    expect(state.segments.map((s) => s.kind)).toEqual(['run', 'walk']);
    expect(state.openSegment).toMatchObject({ idx: 2, kind: 'km', startedElapsedMs: 60_000 });
  });
});

describe('인터벌 화면 값', () => {
  it('지금 구간의 남은 시간을 크게, 다음 구간을 아래에, 구간 띠를 함께 준다', () => {
    const view = describeRun(start(INTERVAL, '인터벌 입문 3회차'), T0 + 342_000);
    expect(view).toMatchObject({
      title: '인터벌 입문 3회차',
      elapsedText: '경과 5:42',
      primaryLabel: '달리기 · 남은 시간',
      primaryValue: '0:18',
      secondaryText: '다음  걷기 1:30',
    });
    expect(view.lane).toMatchObject({
      currentIndex: 4,
      countText: '5 / 16 구간',
      caption: '달리기 1:00 · 걷기 1:30 × 8',
    });
    expect(view.lane?.steps).toHaveLength(16);
    expect(view.lane?.progress).toBeCloseTo(0.7, 5);
    expect(view.gauge).toBeNull();
  });

  it('구간이 시작되는 순간에는 구간 길이 그대로 보인다(0:59가 아니라 1:00)', () => {
    expect(describeRun(start(INTERVAL), T0).primaryValue).toBe('1:00');
    expect(describeRun(start(INTERVAL), T0 + 500).primaryValue).toBe('1:00');
  });

  it('마지막 구간의 다음은 "끝"이고, 마친 뒤에는 경과 시간을 보여 준다', () => {
    expect(describeRun(start(INTERVAL), T0 + 1_150_000).secondaryText).toBe('다음  끝');
    const done = describeRun(start(INTERVAL), T0 + 1_230_000);
    expect(done.primaryLabel).toBe('인터벌 완료 · 경과 시간');
    expect(done.primaryValue).toBe('20:30');
    expect(done.lane).toMatchObject({ currentIndex: 16, countText: '16 / 16 구간' });
  });
});

describe('케이던스', () => {
  const CADENCE = { mode: 'cadence', spm: 170, durationSec: 1200 } as const;

  it('5분마다 시간과 거리를 말하고, 목표 시간을 채우면 한 번 알린다', () => {
    const { speeches } = run(start(CADENCE), 0, 1205, 3);
    expect(speeches).toEqual([
      '5분. 0.9킬로미터',
      '오늘 1회 인정!', // 10분을 채운 순간. 같은 순간의 시간 안내보다 먼저 나온다
      '10분. 1.8킬로미터',
      '15분. 2.7킬로미터',
      '20분. 3.6킬로미터',
      '목표 시간을 채웠어요',
    ]);
  });

  it('남은 시간을 크게, 걸음 수를 아래에 보여 준다', () => {
    const view = describeRun(start(CADENCE), T0 + 342_000);
    expect(view).toMatchObject({
      primaryLabel: '발걸음 박자 · 남은 시간',
      primaryValue: '14:18',
      secondaryText: '분당 170걸음',
      lane: null,
      gauge: null,
    });
  });
});

describe('페이스메이커', () => {
  // 목표 6'40"/km = 초속 2.5m
  const PACEMAKER = { mode: 'pacemaker', targetPaceSecPerKm: 400, distanceM: 3000 } as const;

  it('목표 범위(±10초) 안이면 1km마다만 말한다', () => {
    const { speeches } = run(start(PACEMAKER), 0, 420, 2.5);
    expect(speeches).toEqual(['1킬로미터. 평균 페이스 6분 40초']);
  });

  it('목표보다 느리면 "조금 빠르게"라고 알리고, 같은 안내는 30초 안에 되풀이하지 않는다', () => {
    // 초속 2m = 500초/km → 목표보다 100초 느림
    const { speeches } = run(start(PACEMAKER), 0, 95, 2);
    expect(speeches).toEqual([
      '조금 빠르게. 목표보다 100초 느려요', // 최근 20초 평균이 생기는 20초쯤
      '조금 빠르게. 목표보다 100초 느려요', // 30초 뒤
      '조금 빠르게. 목표보다 100초 느려요', // 다시 30초 뒤
    ]);
  });

  it('목표보다 빠르면 "조금 천천히"라고 알린다', () => {
    // 초속 3m ≈ 333초/km → 목표보다 67초 빠름
    const { speeches } = run(start(PACEMAKER), 0, 25, 3);
    expect(speeches).toEqual(['조금 천천히. 목표보다 67초 빨라요']);
  });

  it('속도를 맞추면 안내가 멈춘다', () => {
    const slow = run(start(PACEMAKER), 0, 40, 2);
    const fixed = run(slow.state, 41, 120, 2.5, slow.meters + 2.5);
    // 최근 30초가 목표 속도로 바뀐 뒤(약 70초 이후)에는 페이스 안내가 없다
    const settled = run(fixed.state, 121, 200, 2.5, fixed.meters + 2.5);
    expect(settled.speeches.filter((s) => s.startsWith('조금'))).toEqual([]);
    expect(describeRun(fixed.state, T0 + 120_000).gauge).toMatchObject({ text: '목표 페이스' });
  });

  it('GPS가 끊겨 지금 페이스를 모르면 페이스 안내를 멈춘다', () => {
    // 느리게 뛰다가(안내가 나오던 중) 위치가 더 들어오지 않는다
    const slow = run(start(PACEMAKER), 0, 40, 2);
    let state = slow.state;
    const speeches: string[] = [];
    for (let sec = 41; sec <= 120; sec++) {
      const stepped = tick(state, T0 + sec * 1000, OPTIONS);
      state = stepped.state;
      speeches.push(...stepped.cues.map((cue) => cue.speech));
    }
    expect(state.gpsLost).toBe(true);
    expect(speeches.filter((s) => s.startsWith('조금'))).toEqual([]);
    expect(describeRun(state, T0 + 120_000).gauge).toMatchObject({ gapSec: null, markerRatio: null, text: '페이스를 재는 중' });
  });

  it('목표 거리를 채우면 한 번 알리고, 그 뒤로는 페이스를 맞추라고 하지 않는다', () => {
    // 목표 1km를 느린 속도(초속 2m)로: 채운 뒤에도 느리지만 "조금 빠르게"는 더 나오지 않는다
    const { speeches } = run(start({ ...PACEMAKER, distanceM: 1000 }), 0, 620, 2);
    expect(speeches.filter((s) => s === '목표 거리를 채웠어요')).toHaveLength(1);
    const doneAt = speeches.indexOf('목표 거리를 채웠어요');
    expect(speeches.slice(doneAt + 1).filter((s) => s.startsWith('조금'))).toEqual([]);
  });

  it('목표 거리를 채운 뒤 더 뛰면 1km마다 거리 안내를 이어 간다', () => {
    const { speeches } = run(start({ ...PACEMAKER, distanceM: 1250 }), 0, 810, 2.5);
    // 1km(범위 안이라 km 안내) → 1.25km에서 목표 달성(500초) → 10분 인정(600초) → 2km 안내(800초)
    expect(speeches).toEqual([
      '1킬로미터. 평균 페이스 6분 40초',
      '목표 거리를 채웠어요',
      '오늘 1회 인정!',
      '2킬로미터. 평균 페이스 6분 40초',
    ]);
  });

  it('게이지 글자와 음성 안내는 같은 기준으로 갈린다(허용 범위를 조금만 넘어도 벗어난 것)', () => {
    const withGap = (gap: number) => {
      // 최근 표본 두 개로 원하는 페이스를 만든다: 30초 동안 30000 / (목표 + gap) km
      const pace = PACEMAKER.targetPaceSecPerKm + gap;
      const state = start(PACEMAKER);
      return {
        ...state,
        distanceM: 30_000 / pace,
        lastFixAt: T0 + 30_000,
        paceSamples: [
          { elapsedMs: 0, distanceM: 0 },
          { elapsedMs: 30_000, distanceM: 30_000 / pace },
        ],
      };
    };
    expect(describeRun(withGap(10), T0 + 30_000).gauge?.text).toBe('목표 페이스');
    expect(describeRun(withGap(10.4), T0 + 30_000).gauge?.text).toBe('+10초 느림');
    expect(describeRun(withGap(-10.4), T0 + 30_000).gauge?.text).toBe('10초 빠름');
    expect(modeSpeeches(tick(withGap(10.4), T0 + 30_000, OPTIONS).cues)).toEqual(['조금 빠르게. 목표보다 10초 느려요']);
    expect(modeSpeeches(tick(withGap(10), T0 + 30_000, OPTIONS).cues)).toEqual([]);
  });

  it('게이지의 마커는 느릴수록 왼쪽, 빠를수록 오른쪽이고 ±60초에서 끝에 붙는다', () => {
    const slow = describeRun(run(start(PACEMAKER), 0, 40, 2).state, T0 + 40_000).gauge;
    expect(slow?.markerRatio).toBe(0); // 100초 느림 → 왼쪽 끝
    const fast = describeRun(run(start(PACEMAKER), 0, 40, 3).state, T0 + 40_000).gauge;
    expect(fast?.markerRatio).toBe(1); // 67초 빠름 → 오른쪽 끝
    const onTarget = describeRun(run(start(PACEMAKER), 0, 40, 2.5).state, T0 + 40_000).gauge;
    expect(onTarget?.markerRatio).toBeCloseTo(0.5, 2);
    // 목표 띠는 ±10초 = 전체(±60초)의 6분의 1
    expect(onTarget?.bandRatio).toBeCloseTo(1 / 6, 5);
  });

  it('게이지에 목표와의 차이를 글자로도 준다', () => {
    const measuring = describeRun(start(PACEMAKER), T0 + 5_000);
    expect(measuring.gauge).toEqual({
      gapSec: null,
      toleranceSec: 10,
      text: '페이스를 재는 중',
      markerRatio: null,
      bandRatio: 1 / 6,
    });
    expect(measuring.primaryValue).toBe(`-'--"`);

    const slow = describeRun(run(start(PACEMAKER), 0, 40, 2).state, T0 + 40_000);
    expect(slow.gauge?.text).toBe('+100초 느림');
    expect(slow.gauge?.gapSec).toBeCloseTo(100, 0);
    expect(slow.primaryLabel).toBe('지금 페이스');
    expect(slow.primaryValue).toBe(`8'20"`);
    expect(slow.secondaryText).toBe(`목표 6'40"/km · 남은 거리 3km`);

    const fast = describeRun(run(start(PACEMAKER), 0, 40, 3).state, T0 + 40_000);
    expect(fast.gauge?.text).toBe('67초 빠름');
  });
});

describe('자유 러닝', () => {
  it('목표 시간을 채우면 한 번 알리고, 끝내지 않고 계속 기록한다', () => {
    const state = start({ mode: 'free', targetDurationSec: 600 });
    const done = tick(state, T0 + 600_000, OPTIONS);
    expect(modeSpeeches(done.cues)).toEqual(['오늘 1회 인정!', '목표 시간을 채웠어요']);
    expect(done.state.status).toBe('active');
    expect(tick(done.state, T0 + 601_000, OPTIONS).cues).toEqual([]);
  });

  it('시간 제한이 없으면 목표 안내가 없다', () => {
    const done = tick(start({ mode: 'free', targetDurationSec: null }), T0 + 3_600_000, OPTIONS);
    expect(modeSpeeches(done.cues)).toEqual(['오늘 1회 인정!']);
  });
});
