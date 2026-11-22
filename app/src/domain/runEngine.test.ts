import { describe, expect, it } from 'vitest';

import { averagePaceSecPerKm } from './pace';
import {
  applyLocation,
  currentPaceSecPerKm,
  elapsedMs,
  finish,
  msUntilCounted,
  pause,
  resume,
  startRun,
  suspendAt,
  tick,
  type LocationFix,
  type RunState,
} from './runEngine';

const T0 = 1_700_000_000_000;
const OPTIONS = { voiceIntervalKm: 1 };
// 위도 1도 ≈ 111.19km → 북쪽으로 1m 움직일 때의 위도 차
const DEG_PER_M = 1 / 111_194.9;

function start(): RunState {
  return startRun({ runId: 'run-1', config: { mode: 'free', targetDurationSec: null }, planLabel: null, now: T0 }).state;
}

/** 시작점에서 북쪽으로 meters만큼 떨어진 위치 */
function fixAt(sec: number, meters: number, accuracy: number | null = 5): LocationFix {
  return { t: T0 + sec * 1000, lat: 37.5 + meters * DEG_PER_M, lng: 127, accuracy };
}

/** speedMps로 일정하게 뛰며 1초마다 위치를 넣는다. fromSec 시점의 위치가 fromM */
function runSteady(state: RunState, fromSec: number, toSec: number, speedMps: number, fromM = 0): RunState {
  let next = state;
  for (let sec = fromSec; sec <= toSec; sec++) {
    next = applyLocation(next, fixAt(sec, fromM + (sec - fromSec) * speedMps)).state;
    next = tick(next, T0 + sec * 1000, OPTIONS).state;
  }
  return next;
}

describe('시작과 경과 시간', () => {
  it('시작하면 "시작합니다" 안내를 한 번 내보낸다', () => {
    const { state, cues } = startRun({
      runId: 'run-1',
      config: { mode: 'free', targetDurationSec: null },
      planLabel: null,
      now: T0,
    });
    expect(cues.map((c) => c.key)).toEqual(['start']);
    expect(state.status).toBe('active');
    expect(state.lastCueDisplay).toBe('시작합니다');
  });

  it('경과 시간은 지금 시각에서 시작 시각을 뺀 값이다(몇 번 불렀는지와 상관없다)', () => {
    const state = start();
    expect(elapsedMs(state, T0 + 5_000)).toBe(5_000);
    // 타이머가 30초 동안 한 번도 안 불렸다가 불려도 값은 맞다
    expect(elapsedMs(state, T0 + 35_000)).toBe(35_000);
  });

  it('일시정지한 시간은 경과 시간에서 빠진다', () => {
    let state = start();
    state = pause(state, T0 + 60_000).state;
    expect(elapsedMs(state, T0 + 90_000)).toBe(60_000);
    state = resume(state, T0 + 100_000).state;
    expect(elapsedMs(state, T0 + 130_000)).toBe(90_000);
  });

  it('일시정지 · 재개는 음성 확인 안내를 내보내고, 같은 상태에서 다시 눌러도 아무 일도 없다', () => {
    const paused = pause(start(), T0 + 10_000);
    expect(paused.cues.map((c) => c.speech)).toEqual(['일시정지']);
    expect(pause(paused.state, T0 + 11_000).cues).toEqual([]);

    const resumed = resume(paused.state, T0 + 20_000);
    expect(resumed.cues.map((c) => c.speech)).toEqual(['다시 시작합니다']);
    expect(resume(resumed.state, T0 + 21_000).cues).toEqual([]);
  });
});

describe('거리 계산', () => {
  it('첫 위치는 기준점만 잡고 거리는 0이다', () => {
    const { state, point } = applyLocation(start(), fixAt(1, 0));
    expect(state.distanceM).toBe(0);
    expect(point).toMatchObject({ elapsedMs: 1000 });
  });

  it('움직인 만큼 거리를 더한다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    state = applyLocation(state, fixAt(2, 3)).state;
    state = applyLocation(state, fixAt(3, 6)).state;
    expect(state.distanceM).toBeCloseTo(6, 1);
  });

  it('오차가 큰 위치는 버린다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    const result = applyLocation(state, fixAt(2, 3, 80));
    expect(result.point).toBeNull();
    expect(result.state.distanceM).toBe(0);
    // 버린 위치는 기준점도 바꾸지 않는다
    state = applyLocation(result.state, fixAt(3, 6)).state;
    expect(state.distanceM).toBeCloseTo(6, 1);
  });

  it('제자리 흔들림(2m 미만)은 더하지 않는다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    state = applyLocation(state, fixAt(2, 1)).state;
    state = applyLocation(state, fixAt(3, 0.5)).state;
    expect(state.distanceM).toBe(0);
  });

  it('사람이 낼 수 없는 속도로 튄 위치는 버린다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    const jumped = applyLocation(state, fixAt(2, 200));
    expect(jumped.point).toBeNull();
    expect(jumped.state.distanceM).toBe(0);
  });

  it('일시정지 중에 받은 위치는 무시하고, 재개 뒤에는 멈춰 있던 동안의 이동을 더하지 않는다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    state = applyLocation(state, fixAt(2, 3)).state;
    state = pause(state, T0 + 3_000).state;

    const whilePaused = applyLocation(state, fixAt(10, 50));
    expect(whilePaused.point).toBeNull();

    state = resume(whilePaused.state, T0 + 60_000).state;
    state = applyLocation(state, fixAt(61, 100)).state; // 재개 뒤 첫 위치: 기준만 다시 잡는다
    expect(state.distanceM).toBeCloseTo(3, 1);
    state = applyLocation(state, fixAt(62, 103)).state;
    expect(state.distanceM).toBeCloseTo(6, 1);
  });

  it('시각이 거꾸로 온 위치는 무시한다', () => {
    let state = applyLocation(start(), fixAt(5, 0)).state;
    const stale = applyLocation(state, fixAt(4, 3));
    expect(stale.point).toBeNull();
    state = stale.state;
    expect(state.distanceM).toBe(0);
  });
});

describe('GPS 끊김', () => {
  it('10초 넘게 위치가 없으면 끊김으로 바꾸고 안내를 한 번만 내보낸다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    expect(tick(state, T0 + 10_000, OPTIONS).state.gpsLost).toBe(false);

    const lost = tick(state, T0 + 12_000, OPTIONS);
    expect(lost.state.gpsLost).toBe(true);
    expect(lost.cues).toHaveLength(1);
    expect(lost.cues[0].display).toBe('GPS 신호를 찾는 중이에요');

    state = lost.state;
    expect(tick(state, T0 + 13_000, OPTIONS).cues).toEqual([]);
  });

  it('끊긴 동안에도 경과 시간은 계속 흐른다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    state = tick(state, T0 + 30_000, OPTIONS).state;
    expect(state.gpsLost).toBe(true);
    expect(elapsedMs(state, T0 + 30_000)).toBe(30_000);
  });

  it('신호가 돌아오면 끊긴 동안의 이동은 더하지 않고 그 자리부터 다시 잰다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    state = applyLocation(state, fixAt(2, 3)).state;
    state = tick(state, T0 + 20_000, OPTIONS).state;
    expect(state.gpsLost).toBe(true);

    state = applyLocation(state, fixAt(40, 120)).state;
    expect(state.gpsLost).toBe(false);
    expect(state.distanceM).toBeCloseTo(3, 1);

    state = applyLocation(state, fixAt(41, 123)).state;
    expect(state.distanceM).toBeCloseTo(6, 1);
  });

  it('시작 직후 첫 위치는 20초까지 기다려 주고, 그래도 없으면 끊김으로 본다', () => {
    // 위치 서비스가 켜지는 데 걸리는 시간을 끊김으로 오해하지 않는다
    expect(tick(start(), T0 + 15_000, OPTIONS).state.gpsLost).toBe(false);
    expect(tick(start(), T0 + 21_000, OPTIONS).state.gpsLost).toBe(true);
  });

  it('신호가 돌아오면 화면의 "찾는 중" 문구를 "다시 잡았어요"로 바꾼다(음성 안내는 없다)', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    state = tick(state, T0 + 15_000, OPTIONS).state;
    expect(state.lastCueDisplay).toBe('GPS 신호를 찾는 중이에요');

    state = applyLocation(state, fixAt(20, 10)).state;
    expect(state.lastCueDisplay).toBe('GPS 신호를 다시 잡았어요');
    // 돌아왔다는 안내는 내보내지 않는다(끊김 음성 1회만)
    expect(tick(state, T0 + 21_000, OPTIONS).cues).toEqual([]);
  });

  it('신호가 두 번 끊기면 안내도 두 번 나간다', () => {
    let state = applyLocation(start(), fixAt(1, 0)).state;
    const first = tick(state, T0 + 15_000, OPTIONS);
    expect(first.cues).toHaveLength(1);
    state = applyLocation(first.state, fixAt(20, 10)).state;
    const second = tick(state, T0 + 40_000, OPTIONS);
    expect(second.cues).toHaveLength(1);
    expect(second.cues[0].key).not.toBe(first.cues[0].key);
  });
});

describe('페이스', () => {
  it('최근 20초 이상 표본이 쌓여야 현재 페이스를 낸다', () => {
    let state = runSteady(start(), 0, 10, 3);
    expect(currentPaceSecPerKm(state)).toBeNull();
    state = runSteady(state, 11, 25, 3, 33);
    // 초속 3m = 1km에 333초
    expect(currentPaceSecPerKm(state)).toBeCloseTo(333.3, 0);
  });

  it('현재 페이스는 최근 30초만 본다', () => {
    let state = runSteady(start(), 0, 60, 2);
    state = runSteady(state, 61, 120, 4, 124);
    // 앞의 느린 구간은 빠지고 최근 속도(초속 4m = 250초)만 남는다
    expect(currentPaceSecPerKm(state)).toBeCloseTo(250, 0);
  });

  it('평균 페이스는 50m 이상 뛰어야 낸다', () => {
    expect(averagePaceSecPerKm(10_000, 30)).toBeNull();
    expect(averagePaceSecPerKm(368_000, 1000)).toBeCloseTo(368, 5);
  });
});

describe('10분 인정', () => {
  it('10분을 채우는 순간 인정하고 토스트 안내를 한 번 내보낸다', () => {
    const state = start();
    expect(tick(state, T0 + 599_000, OPTIONS).state.counted).toBe(false);
    expect(msUntilCounted(state, T0 + 480_000)).toBe(120_000);

    const done = tick(state, T0 + 600_000, OPTIONS);
    expect(done.state.counted).toBe(true);
    const cue = done.cues.find((c) => c.key === 'counted');
    expect(cue).toMatchObject({ speech: '오늘 1회 인정!', toast: true });

    expect(tick(done.state, T0 + 601_000, OPTIONS).cues.find((c) => c.key === 'counted')).toBeUndefined();
  });

  it('일시정지 시간은 10분에 넣지 않는다', () => {
    let state = pause(start(), T0 + 300_000).state;
    state = resume(state, T0 + 900_000).state;
    expect(tick(state, T0 + 1_100_000, OPTIONS).state.counted).toBe(false);
    expect(tick(state, T0 + 1_200_000, OPTIONS).state.counted).toBe(true);
  });
});

describe('자유 모드 거리 안내와 km 구간', () => {
  it('1km를 지나면 거리와 평균 페이스를 말하고 km 구간을 닫는다', () => {
    // 초속 3m로 340초 → 1020m
    const state = runSteady(start(), 0, 340, 3);
    expect(state.emitted).toContain('km-1');
    expect(state.lastCueDisplay).toBe('1km를 지났어요');
    expect(state.segments).toHaveLength(1);
    expect(state.segments[0]).toMatchObject({ idx: 0, kind: 'km', startedElapsedMs: 0, distanceM: 1000 });
    expect(state.openSegment).toMatchObject({ idx: 1, startDistanceM: 1000 });
  });

  it('안내 간격을 2km로 두면 1km에서는 말하지 않는다', () => {
    let state = start();
    for (let sec = 0; sec <= 340; sec++) {
      state = applyLocation(state, fixAt(sec, sec * 3)).state;
      state = tick(state, T0 + sec * 1000, { voiceIntervalKm: 2 }).state;
    }
    expect(state.emitted).not.toContain('km-1');
  });
});

describe('종료', () => {
  it('요약에 경과 시간 · 거리 · 평균 페이스 · 구간을 담는다', () => {
    const state = runSteady(start(), 0, 400, 3);
    const summary = finish(state, T0 + 400_000);
    expect(summary.elapsedMs).toBe(400_000);
    expect(summary.distanceM).toBeCloseTo(1200, 0);
    expect(summary.avgPaceSecPerKm).toBeCloseTo(333.3, 0);
    expect(summary.counted).toBe(false);
    // 닫힌 1km 구간 + 열려 있던 마지막 구간
    expect(summary.segments).toHaveLength(2);
    expect(summary.segments[1].distanceM).toBeCloseTo(200, 0);
    expect(summary.segments[0].durationMs + summary.segments[1].durationMs).toBe(400_000);
  });

  it('일시정지 상태에서 끝내면 멈춘 시각까지만 기록한다', () => {
    let state = runSteady(start(), 0, 100, 3);
    state = pause(state, T0 + 100_000).state;
    const summary = finish(state, T0 + 500_000);
    expect(summary.elapsedMs).toBe(100_000);
    expect(summary.endedAt).toBe(T0 + 100_000);
  });

  it('10분 넘게 뛰고 끝내면 인정된다', () => {
    const summary = finish(start(), T0 + 601_000);
    expect(summary.counted).toBe(true);
    // 위치를 한 번도 못 받았으면 거리 0, 페이스 없음
    expect(summary.distanceM).toBe(0);
    expect(summary.avgPaceSecPerKm).toBeNull();
  });
});

describe('강제 종료 복구', () => {
  it('마지막 저장 시각에 멈춘 것으로 바꾸면, 앱이 꺼져 있던 시간은 경과 시간에 들어가지 않는다', () => {
    let state = runSteady(start(), 0, 120, 3);
    // 120초에 마지막으로 저장되고 앱이 죽었다가 10분 뒤 다시 켜짐
    state = suspendAt(state, T0 + 120_000);
    expect(state.status).toBe('paused');
    expect(elapsedMs(state, T0 + 720_000)).toBe(120_000);

    // 이어서: 꺼져 있던 동안의 이동은 더하지 않는다
    const before = state.distanceM;
    state = resume(state, T0 + 720_000).state;
    state = applyLocation(state, fixAt(721, 5000)).state;
    expect(state.distanceM).toBe(before);
    expect(elapsedMs(state, T0 + 730_000)).toBe(130_000);
  });

  it('여기까지 저장: 멈춘 시각 기준으로 요약을 만든다', () => {
    let state = runSteady(start(), 0, 120, 3);
    state = suspendAt(state, T0 + 120_000);
    const summary = finish(state, T0 + 720_000);
    expect(summary.elapsedMs).toBe(120_000);
    expect(summary.endedAt).toBe(T0 + 120_000);
  });

  it('이미 일시정지 상태였으면 그대로 둔다', () => {
    const paused = pause(start(), T0 + 30_000).state;
    expect(suspendAt(paused, T0 + 90_000)).toBe(paused);
  });
});
