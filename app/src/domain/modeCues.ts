/**
 * 모드별 안내 판단. runEngine.tick이 매번 부른다.
 * 자유 모드만 여기 있고, 인터벌 · 케이던스 · 페이스메이커는 F-003에서 채운다.
 */
import { speakDistanceKm, speakPace } from './format';
import { averagePaceSecPerKm } from './pace';
import type { Cue, RunSegment, RunState, StepOptions } from './runEngine';

export type ModeResult = {
  cues: Cue[];
  /** 모드가 기억해 둘 숫자(예: 마지막 페이스 안내 시각). 상태의 modeMemo에 합쳐진다. */
  memo?: Record<string, number>;
  /** 모드가 구간 기록을 직접 관리할 때(인터벌)만 돌려준다. */
  segments?: { segments: RunSegment[]; openSegment: RunState['openSegment'] };
};

export function modeCues(state: RunState, elapsed: number, options: StepOptions): ModeResult {
  switch (state.config.mode) {
    case 'free':
      return freeCues(state, elapsed, options);
    case 'interval':
    case 'cadence':
    case 'pacemaker':
      return { cues: [] };
  }
}

/** 자유 모드: 설정한 간격(km)마다 거리와 평균 페이스를 말한다. */
function freeCues(state: RunState, elapsed: number, options: StepOptions): ModeResult {
  return { cues: distanceCues(state, elapsed, options.voiceIntervalKm) };
}

/** 지금까지 지난 km 지점 가운데 stepKm 배수인 것의 안내. 이미 내보낸 것은 엔진이 걸러 낸다. */
export function distanceCues(state: RunState, elapsed: number, stepKm: number): Cue[] {
  const step = Math.max(1, Math.round(stepKm));
  const passedKm = Math.floor(state.distanceM / 1000);
  const latest = passedKm - (passedKm % step);
  // 한 번에 여러 지점을 넘었어도(오랜만에 계산된 경우) 가장 최근 지점만 말한다
  return latest >= step ? [kmCue(latest, elapsed)] : [];
}

/** n km 지점 안내(자유 · 케이던스 · 페이스메이커가 함께 쓴다). */
export function kmCue(km: number, elapsed: number): Cue {
  const meters = km * 1000;
  const pace = averagePaceSecPerKm(elapsed, meters);
  return {
    key: `km-${km}`,
    speech: pace ? `${speakDistanceKm(meters)}. 평균 페이스 ${speakPace(pace)}` : speakDistanceKm(meters),
    display: `${km}km를 지났어요`,
  };
}
