/**
 * 시작 전 설정 시트에서 조절하는 목표값 칸. 모드마다 어떤 값을 어떤 범위(CONFIG_LIMITS)로
 * 바꿀 수 있는지와, 한 칸 줄이거나 늘렸을 때의 설정을 만든다. 화면은 받은 값을 그리기만 한다.
 */
import { formatKm, formatPace, speakDuration } from '@/domain/format';
import { CONFIG_LIMITS } from '@/domain/runConfig';
import type { RunConfig, RunMode } from '@/domain/types';

type Limit = { min: number; max: number; step: number };
type ConfigOf<M extends RunMode> = Extract<RunConfig, { mode: M }>;

export type ConfigField = {
  key: string;
  label: string;
  /** 지금 값을 보여 줄 글자. 예: "1분 30초" */
  valueText: string;
  /** 한 칸 줄인 설정. 범위 끝이라 더 줄일 수 없으면 null */
  decreased: RunConfig | null;
  /** 한 칸 늘린 설정. 범위 끝이라 더 늘릴 수 없으면 null */
  increased: RunConfig | null;
};

/** 목표값 줄의 제목 */
export const CONFIG_TITLE: Record<RunMode, string> = {
  free: '목표 시간',
  interval: '구간 설정',
  cadence: '박자 설정',
  pacemaker: '페이스 설정',
};

export const NO_TIME_LIMIT_TEXT = '제한 없음';

/** 범위 안에서 한 칸 옮긴 값. 칸에 맞지 않는 값(예: 45초)은 옮기는 쪽의 가까운 칸으로 맞춘다. */
function stepValue(value: number, { min, max, step }: Limit, direction: 1 | -1): number | null {
  if (direction === 1) {
    if (value >= max) return null;
    return Math.min(max, Math.max(min, Math.floor(value / step) * step + step));
  }
  if (value <= min) return null;
  return Math.max(min, Math.min(max, Math.ceil(value / step) * step - step));
}

function numberField(args: {
  key: string;
  label: string;
  valueText: string;
  /** 설정에 저장된 값(초 · 미터 등) */
  value: number;
  limit: Limit;
  /** 범위의 단위 1이 저장 값으로 얼마인지. 분 단위 범위 + 초 저장이면 60 */
  unit: number;
  apply: (next: number) => RunConfig;
}): ConfigField {
  const { key, label, valueText, value, limit, unit, apply } = args;
  const down = stepValue(value / unit, limit, -1);
  const up = stepValue(value / unit, limit, 1);
  return {
    key,
    label,
    valueText,
    decreased: down == null ? null : apply(down * unit),
    increased: up == null ? null : apply(up * unit),
  };
}

function freeFields(config: ConfigOf<'free'>): ConfigField[] {
  const limit = CONFIG_LIMITS.freeDurationMin;
  const key = 'targetDurationSec';
  const label = '목표 시간';
  const sec = config.targetDurationSec;
  if (sec == null) {
    return [
      {
        key,
        label,
        valueText: NO_TIME_LIMIT_TEXT,
        decreased: null,
        increased: { ...config, targetDurationSec: limit.min * 60 },
      },
    ];
  }
  const field = numberField({
    key,
    label,
    valueText: speakDuration(sec),
    value: sec,
    limit,
    unit: 60,
    apply: (targetDurationSec) => ({ ...config, targetDurationSec }),
  });
  // 가장 짧은 시간에서 한 번 더 줄이면 '제한 없음'(직접 끝낼 때까지 기록)이 된다
  return [{ ...field, decreased: field.decreased ?? { ...config, targetDurationSec: null } }];
}

function intervalFields(config: ConfigOf<'interval'>): ConfigField[] {
  return [
    numberField({
      key: 'runSec',
      label: '달리기',
      valueText: speakDuration(config.runSec),
      value: config.runSec,
      limit: CONFIG_LIMITS.intervalRunSec,
      unit: 1,
      apply: (runSec) => ({ ...config, runSec }),
    }),
    numberField({
      key: 'walkSec',
      label: '걷기',
      valueText: speakDuration(config.walkSec),
      value: config.walkSec,
      limit: CONFIG_LIMITS.intervalWalkSec,
      unit: 1,
      apply: (walkSec) => ({ ...config, walkSec }),
    }),
    numberField({
      key: 'repeats',
      label: '반복',
      valueText: `${config.repeats}회`,
      value: config.repeats,
      limit: CONFIG_LIMITS.intervalRepeats,
      unit: 1,
      apply: (repeats) => ({ ...config, repeats }),
    }),
  ];
}

function cadenceFields(config: ConfigOf<'cadence'>): ConfigField[] {
  return [
    numberField({
      key: 'spm',
      label: '분당 걸음 수',
      valueText: `${config.spm}걸음`,
      value: config.spm,
      limit: CONFIG_LIMITS.cadenceSpm,
      unit: 1,
      apply: (spm) => ({ ...config, spm }),
    }),
    numberField({
      key: 'durationSec',
      label: '시간',
      valueText: speakDuration(config.durationSec),
      value: config.durationSec,
      limit: CONFIG_LIMITS.cadenceDurationMin,
      unit: 60,
      apply: (durationSec) => ({ ...config, durationSec }),
    }),
  ];
}

function pacemakerFields(config: ConfigOf<'pacemaker'>): ConfigField[] {
  return [
    numberField({
      key: 'targetPaceSecPerKm',
      label: '목표 페이스',
      valueText: `${formatPace(config.targetPaceSecPerKm)}/km`,
      value: config.targetPaceSecPerKm,
      limit: CONFIG_LIMITS.pacemakerPaceSec,
      unit: 1,
      apply: (targetPaceSecPerKm) => ({ ...config, targetPaceSecPerKm }),
    }),
    numberField({
      key: 'distanceM',
      label: '거리',
      valueText: formatKm(config.distanceM),
      value: config.distanceM,
      limit: CONFIG_LIMITS.pacemakerDistanceKm,
      unit: 1000,
      apply: (distanceM) => ({ ...config, distanceM }),
    }),
  ];
}

/** 지금 설정에서 조절할 수 있는 칸들 */
export function configFields(config: RunConfig): ConfigField[] {
  switch (config.mode) {
    case 'free':
      return freeFields(config);
    case 'interval':
      return intervalFields(config);
    case 'cadence':
      return cadenceFields(config);
    case 'pacemaker':
      return pacemakerFields(config);
  }
}
