/**
 * 러닝 중 화면에 보여 줄 글자와 숫자를 계산 상태에서 뽑아낸다.
 * 화면 컴포넌트는 여기서 받은 값을 그리기만 한다(모드마다 달라지는 판단을 화면에 두지 않는다).
 */
import { formatDistanceKm, formatDuration, formatPace } from './format';
import { averagePaceSecPerKm } from './pace';
import { elapsedMs, msUntilCounted, type RunState } from './runEngine';
import type { RunMode } from './types';

export const MODE_LABEL: Record<RunMode, string> = {
  free: '자유 러닝',
  interval: '인터벌',
  cadence: '발걸음 박자',
  pacemaker: '페이스메이커',
};

export type RunView = {
  /** 맨 위 작은 제목(계획 이름 또는 모드 이름) */
  title: string;
  /** 맨 위 오른쪽 "경과 5:42" */
  elapsedText: string;
  /** 큰 숫자 위 라벨. 예: "달리기 · 남은 시간" */
  primaryLabel: string;
  /** 화면에서 가장 큰 숫자. 예: "0:18" */
  primaryValue: string;
  /** 큰 숫자 아래 한 줄. 예: "다음  걷기 1:30" */
  secondaryText: string;
  distanceText: string;
  /** 거리 숫자 아래 설명. GPS가 끊기면 "거리 · GPS 찾는 중" */
  distanceCaption: string;
  paceText: string;
  paceCaption: string;
  /** 가장 최근 음성 안내 문장. 아직 없으면 null */
  lastCue: string | null;
  gpsLost: boolean;
  paused: boolean;
};

// GPS가 끊기면 두 지표의 설명 줄이 바뀐다(피그마 RUN_02_006)
const DISTANCE_CAPTION = '거리';
const DISTANCE_CAPTION_GPS_LOST = '거리 · GPS 찾는 중';
const PACE_CAPTION = '평균 페이스';
const PACE_CAPTION_GPS_LOST = '평균 페이스 · 잠시 멈춤';

export function describeRun(state: RunState, now: number): RunView {
  const elapsed = elapsedMs(state, now);
  const primary = primaryFor(state, now, elapsed);

  return {
    title: state.planLabel ?? MODE_LABEL[state.config.mode],
    elapsedText: `경과 ${formatDuration(elapsed)}`,
    ...primary,
    distanceText: `${formatDistanceKm(state.distanceM)} km`,
    distanceCaption: state.gpsLost ? DISTANCE_CAPTION_GPS_LOST : DISTANCE_CAPTION,
    paceText: `${formatPace(averagePaceSecPerKm(elapsed, state.distanceM))}/km`,
    paceCaption: state.gpsLost ? PACE_CAPTION_GPS_LOST : PACE_CAPTION,
    lastCue: state.lastCueDisplay,
    gpsLost: state.gpsLost,
    paused: state.status === 'paused',
  };
}

type Primary = Pick<RunView, 'primaryLabel' | 'primaryValue' | 'secondaryText'>;

function primaryFor(state: RunState, now: number, elapsed: number): Primary {
  switch (state.config.mode) {
    case 'free':
      return freePrimary(state, now, elapsed);
    // 인터벌 · 케이던스 · 페이스메이커의 전용 표시는 F-003에서 채운다. 그 전까지는 경과 시간을 보여 준다.
    case 'interval':
    case 'cadence':
    case 'pacemaker':
      return { primaryLabel: '경과 시간', primaryValue: formatDuration(elapsed), secondaryText: countedText(state, now) };
  }
}

function freePrimary(state: RunState, now: number, elapsed: number): Primary {
  const target = state.config.mode === 'free' ? state.config.targetDurationSec : null;
  if (target == null) {
    return { primaryLabel: '경과 시간', primaryValue: formatDuration(elapsed), secondaryText: countedText(state, now) };
  }
  const remainingMs = target * 1000 - elapsed;
  if (remainingMs > 0) {
    return {
      primaryLabel: '자유 러닝 · 남은 시간',
      primaryValue: formatDuration(remainingMs),
      secondaryText: `목표 ${formatDuration(target * 1000)}`,
    };
  }
  // 목표 시간을 넘겨도 끝내지 않는다. 직접 끝낼 때까지 기록한다.
  return {
    primaryLabel: '목표를 채웠어요 · 경과 시간',
    primaryValue: formatDuration(elapsed),
    secondaryText: countedText(state, now),
  };
}

function countedText(state: RunState, now: number): string {
  const left = msUntilCounted(state, now);
  return left > 0 ? `1회 인정까지 ${formatDuration(left)}` : '오늘 1회 인정 완료';
}
