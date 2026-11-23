import { describe, expect, it } from 'vitest';

import type { RunSegment } from './runEngine';
import { configFromServer, configToServer, fromServerRun, SERVER_LIMITS, toRunUpload, type SyncableRun } from './syncMapping';

const STARTED_AT = Date.UTC(2026, 10, 19, 22, 12, 0);

function run(overrides: Partial<SyncableRun> = {}): SyncableRun {
  return {
    mode: 'interval',
    config: { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 },
    planLabel: '인터벌 입문 3회차',
    startedAt: STARTED_AT,
    endedAt: STARTED_AT + 21 * 60_000,
    elapsedMs: 20 * 60_000,
    distanceM: 3120.4,
    avgPaceSecPerKm: 384.6,
    ...overrides,
  };
}

const SEGMENTS: RunSegment[] = [
  { idx: 0, kind: 'run', startedElapsedMs: 0, durationMs: 60_400, distanceM: 180.5 },
  { idx: 1, kind: 'walk', startedElapsedMs: 60_400, durationMs: 89_600, distanceM: 120 },
];
const POINTS = [
  { lat: 37.5, lng: 127, elapsedMs: 0 },
  { lat: 37.501, lng: 127.001, elapsedMs: 61_500 },
];

function upload(...args: Parameters<typeof toRunUpload>) {
  const decision = toRunUpload(...args);
  if (decision.kind !== 'upload') throw new Error(`올리지 않음: ${decision.reason}`);
  return decision.body;
}

describe('올릴 모양으로 바꾸기', () => {
  it('문서의 대응표대로 칸 이름과 단위를 바꾼다', () => {
    expect(upload(run(), SEGMENTS, POINTS)).toEqual({
      mode: 'interval',
      config: { run_sec: 60, walk_sec: 90, repeats: 8 },
      plan_label: '인터벌 입문 3회차',
      started_at: '2026-11-19T22:12:00.000Z',
      ended_at: '2026-11-19T22:33:00.000Z',
      elapsed_s: 1200,
      distance_m: 3120.4,
      avg_pace_s_per_km: 384.6,
      segments: [
        { idx: 0, kind: 'run', started_elapsed_s: 0, duration_s: 60, distance_m: 180.5 },
        { idx: 1, kind: 'walk', started_elapsed_s: 60, duration_s: 90, distance_m: 120 },
      ],
      route: [
        [37.5, 127, 0],
        [37.501, 127.001, 61.5],
      ],
    });
  });

  it('config에 mode를 넣지 않는다(서버는 모르는 칸이 있으면 422다)', () => {
    for (const config of [
      { mode: 'free', targetDurationSec: null },
      { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 },
      { mode: 'cadence', spm: 170, durationSec: 1200 },
      { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 },
    ] as const) {
      expect(configToServer(config)).not.toHaveProperty('mode');
    }
  });

  it('모드마다 목표값의 칸 이름을 바꾼다', () => {
    expect(configToServer({ mode: 'free', targetDurationSec: 600 })).toEqual({ target_duration_sec: 600 });
    expect(configToServer({ mode: 'free', targetDurationSec: null })).toEqual({ target_duration_sec: null });
    expect(configToServer({ mode: 'cadence', spm: 170, durationSec: 1200 })).toEqual({ spm: 170, duration_sec: 1200 });
    expect(configToServer({ mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 })).toEqual({
      target_pace_s_per_km: 390,
      distance_m: 3000,
    });
  });

  it('경과 시간은 내린다(599.9초가 600초로 올라가 10분 인정이 어긋나지 않게)', () => {
    expect(upload(run({ elapsedMs: 599_900 }), [], []).elapsed_s).toBe(599);
    expect(upload(run({ elapsedMs: 600_000 }), [], []).elapsed_s).toBe(600);
  });

  it('계획 없이 뛴 러닝 · 페이스를 모르는 러닝은 null로 올린다', () => {
    const body = upload(run({ planLabel: null, avgPaceSecPerKm: null }), [], []);
    expect(body.plan_label).toBeNull();
    expect(body.avg_pace_s_per_km).toBeNull();
    expect(body.segments).toEqual([]);
    expect(body.route).toEqual([]);
  });
});

describe('서버 상한에 맞추기 (Q-006 임시 처리)', () => {
  it('경로가 20000점을 넘으면 고르게 솎고 처음 · 끝 점은 남긴다', () => {
    const points = Array.from({ length: 45_000 }, (_, index) => ({ lat: 37 + index / 1e6, lng: 127, elapsedMs: index * 1000 }));
    const route = upload(run({ endedAt: STARTED_AT + 46_000_000, elapsedMs: 45_000_000 }), [], points).route;
    expect(route).toHaveLength(SERVER_LIMITS.routePoints);
    expect(route[0]).toEqual([37, 127, 0]);
    expect(route[route.length - 1][2]).toBe(44_999);
    // 순서가 뒤집히지 않는다
    expect(route.every((point, index) => index === 0 || point[2] > route[index - 1][2])).toBe(true);
  });

  it('페이스가 서버 상한을 넘거나 0 이하이면 null로 올린다', () => {
    expect(upload(run({ avgPaceSecPerKm: 90_000 }), [], []).avg_pace_s_per_km).toBeNull();
    expect(upload(run({ avgPaceSecPerKm: 0 }), [], []).avg_pace_s_per_km).toBeNull();
    expect(upload(run({ avgPaceSecPerKm: 86_400 }), [], []).avg_pace_s_per_km).toBe(86_400);
  });

  it('이름은 50자로 자르고 NUL 문자를 뺀다', () => {
    const label = upload(run({ planLabel: `가\u0000${'나'.repeat(60)}` }), [], []).plan_label;
    expect(label).toHaveLength(50);
    expect(label).not.toContain('\u0000');
  });

  it('목표값의 실수는 정수로, 범위 밖 값은 범위 안으로 맞춘다', () => {
    expect(configToServer({ mode: 'interval', runSec: 60.4, walkSec: 5000, repeats: 120 })).toEqual({
      run_sec: 60,
      walk_sec: 3600,
      repeats: 99,
    });
    expect(configToServer({ mode: 'cadence', spm: 100, durationSec: 0.2 })).toEqual({ spm: 120, duration_sec: 1 });
    expect(configToServer({ mode: 'pacemaker', targetPaceSecPerKm: 390.6, distanceM: 400_000 })).toEqual({
      target_pace_s_per_km: 391,
      distance_m: 300_000,
    });
  });

  it('24시간이나 300km를 넘는 기록은 올리지 않는다', () => {
    expect(toRunUpload(run({ elapsedMs: 86_401_000 }), [], [])).toEqual({ kind: 'skip', reason: 'too-long' });
    expect(toRunUpload(run({ distanceM: 300_001 }), [], [])).toEqual({ kind: 'skip', reason: 'too-far' });
    expect(toRunUpload(run({ elapsedMs: 86_400_000, endedAt: STARTED_AT + 86_400_000, distanceM: 300_000 }), [], []).kind).toBe('upload');
  });

  it('끝난 시각이 없는 러닝은 올리지 않는다', () => {
    expect(toRunUpload(run({ endedAt: null }), [], [])).toEqual({ kind: 'skip', reason: 'unfinished' });
  });

  it('끝 시각이 "시작 + 경과 시간"보다 빠르게 적힌 기록은 끝 시각을 맞춘다(서버는 경과 시간이 끝 − 시작보다 길면 받지 않는다)', () => {
    // 뛰는 도중 폰의 시계가 뒤로 맞춰진 경우: 20분을 뛰었는데 끝 시각이 시작보다 5초 빠르게 적혔다
    const body = upload(run({ endedAt: STARTED_AT - 5000, elapsedMs: 20 * 60_000 }), [], []);
    expect(body.elapsed_s).toBe(1200);
    expect(Date.parse(body.ended_at) - Date.parse(body.started_at)).toBe(1200_000);

    // 경과 시간이 0이면 시작 시각과 같게 맞춘다
    const empty = upload(run({ endedAt: STARTED_AT - 5000, elapsedMs: 0 }), [], []);
    expect(empty.ended_at).toBe(empty.started_at);
  });

  it('일시정지가 있어 끝 − 시작이 경과 시간보다 긴 기록의 끝 시각은 그대로 둔다', () => {
    const body = upload(run({ endedAt: STARTED_AT + 40 * 60_000, elapsedMs: 20 * 60_000 }), [], []);
    expect(Date.parse(body.ended_at)).toBe(STARTED_AT + 40 * 60_000);
  });

  it('구간 번호는 0부터 차례로 다시 매긴다', () => {
    const body = upload(run(), [{ ...SEGMENTS[0], idx: 4 }, { ...SEGMENTS[1], idx: 9 }], []);
    expect(body.segments.map((segment) => segment.idx)).toEqual([0, 1]);
  });
});

describe('내려받은 러닝 바꾸기', () => {
  const detail = {
    id: '6f1c2a4e-0000-4000-8000-000000000001',
    mode: 'pacemaker',
    config: { target_pace_s_per_km: 390, distance_m: 3000 },
    plan_label: null,
    started_at: '2026-11-19T22:12:00Z',
    ended_at: '2026-11-19T22:33:00+00:00',
    elapsed_s: 1200,
    distance_m: 3120.4,
    avg_pace_s_per_km: 384.6,
    counted: true,
    segments: [{ idx: 0, kind: 'km', started_elapsed_s: 0, duration_s: 380, distance_m: 1000 }],
    route: [
      [37.5, 127, 0],
      [37.501, 127.001, 61.5],
    ],
  };

  it('폰에 넣을 모양으로 바꾼다', () => {
    expect(fromServerRun(detail)).toEqual({
      id: detail.id,
      mode: 'pacemaker',
      config: { mode: 'pacemaker', targetPaceSecPerKm: 390, distanceM: 3000 },
      planLabel: null,
      startedAt: STARTED_AT,
      endedAt: STARTED_AT + 21 * 60_000,
      elapsedMs: 1_200_000,
      distanceM: 3120.4,
      avgPaceSecPerKm: 384.6,
      counted: true,
      segments: [{ idx: 0, kind: 'km', startedElapsedMs: 0, durationMs: 380_000, distanceM: 1000 }],
      points: [
        { lat: 37.5, lng: 127, t: STARTED_AT, accuracy: null, elapsedMs: 0 },
        { lat: 37.501, lng: 127.001, t: STARTED_AT + 61_500, accuracy: null, elapsedMs: 61_500 },
      ],
    });
  });

  it('올린 것을 다시 내려받으면 같은 기록이 된다(경과 시간은 초 단위로)', () => {
    const local = run({ elapsedMs: 1_200_700 });
    const body = upload(local, SEGMENTS, POINTS);
    const back = fromServerRun({ id: 'x', counted: true, ...body });
    expect(back).toMatchObject({
      mode: local.mode,
      config: local.config,
      planLabel: local.planLabel,
      startedAt: local.startedAt,
      endedAt: local.endedAt,
      elapsedMs: 1_200_000,
      distanceM: local.distanceM,
      avgPaceSecPerKm: local.avgPaceSecPerKm,
    });
    expect(back?.points.map((point) => point.elapsedMs)).toEqual([0, 61_500]);
  });

  it('counted가 없으면 10분 기준으로 정한다', () => {
    const { counted: _counted, ...withoutCounted } = detail;
    expect(fromServerRun({ ...withoutCounted, elapsed_s: 599 })?.counted).toBe(false);
    expect(fromServerRun({ ...withoutCounted, elapsed_s: 600 })?.counted).toBe(true);
  });

  it('모양이 틀린 응답은 받지 않는다', () => {
    const broken: unknown[] = [
      null,
      'text',
      { ...detail, id: '' },
      { ...detail, mode: 'swim' },
      { ...detail, config: { target_pace_s_per_km: 390 } },
      { ...detail, config: null },
      { ...detail, started_at: 'yesterday' },
      { ...detail, ended_at: '2026-11-19T22:00:00Z' },
      { ...detail, elapsed_s: -1 },
      { ...detail, distance_m: Number.NaN },
      { ...detail, avg_pace_s_per_km: 0 },
      { ...detail, plan_label: 3 },
      { ...detail, segments: [{ idx: 0, kind: 'swim', started_elapsed_s: 0, duration_s: 1, distance_m: 1 }] },
      { ...detail, segments: 'none' },
      { ...detail, route: [[37.5, 127]] },
      { ...detail, route: [[37.5, 'x', 0]] },
    ];
    for (const value of broken) expect(fromServerRun(value)).toBeNull();
  });

  it('서버가 받는 크기를 넘는 응답은 받지 않는다(폰 DB에 끝없이 넣지 않는다)', () => {
    const point = [37.5, 127, 0];
    const segment = { idx: 0, kind: 'km', started_elapsed_s: 0, duration_s: 1, distance_m: 1 };
    expect(fromServerRun({ ...detail, route: Array.from({ length: SERVER_LIMITS.routePoints + 1 }, () => point) })).toBeNull();
    expect(fromServerRun({ ...detail, segments: Array.from({ length: SERVER_LIMITS.segments + 1 }, () => segment) })).toBeNull();
    expect(fromServerRun({ ...detail, plan_label: '가'.repeat(SERVER_LIMITS.planLabel + 1) })).toBeNull();
    // 상한에 딱 맞는 것은 받는다
    expect(fromServerRun({ ...detail, plan_label: '가'.repeat(SERVER_LIMITS.planLabel) })?.planLabel).toHaveLength(50);
  });

  it('모드마다 목표값을 폰의 모양으로 바꾼다', () => {
    expect(configFromServer('free', { target_duration_sec: null })).toEqual({ mode: 'free', targetDurationSec: null });
    expect(configFromServer('interval', { run_sec: 60, walk_sec: 90, repeats: 8 })).toEqual({
      mode: 'interval',
      runSec: 60,
      walkSec: 90,
      repeats: 8,
    });
    expect(configFromServer('cadence', { spm: 170, duration_sec: 1200 })).toEqual({ mode: 'cadence', spm: 170, durationSec: 1200 });
    expect(configFromServer('cadence', { spm: 500, duration_sec: 1200 })).toBeNull();
  });
});
