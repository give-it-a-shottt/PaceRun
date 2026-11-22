import type { RunPoint, RunSegment, RunState, RunSummary } from '@/domain/runEngine';
import type { RunConfig, RunMode, RunStatus, SyncState } from '@/domain/types';

import type { SQLiteDatabase } from 'expo-sqlite';

import { getDb, withWriteTransaction } from './database';

/** runs 테이블 한 줄을 화면 · 로직에서 쓰기 좋게 바꾼 모양 */
export type RunRecord = {
  id: string;
  mode: RunMode;
  config: RunConfig;
  planLabel: string | null;
  startedAt: number;
  endedAt: number | null;
  status: RunStatus;
  elapsedMs: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
  counted: boolean;
  syncState: SyncState;
};

type RunRow = {
  id: string;
  mode: RunMode;
  config_json: string;
  plan_label: string | null;
  started_at: number;
  ended_at: number | null;
  status: RunStatus;
  elapsed_ms: number;
  distance_m: number;
  avg_pace_s_per_km: number | null;
  counted: number;
  sync_state: SyncState;
};

function toRecord(row: RunRow): RunRecord {
  return {
    id: row.id,
    mode: row.mode,
    config: JSON.parse(row.config_json) as RunConfig,
    planLabel: row.plan_label,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status,
    elapsedMs: row.elapsed_ms,
    distanceM: row.distance_m,
    avgPaceSecPerKm: row.avg_pace_s_per_km,
    counted: row.counted === 1,
    syncState: row.sync_state,
  };
}

export async function insertRun(state: RunState): Promise<void> {
  await withWriteTransaction((db) =>
    db.runAsync(
      `INSERT INTO runs (id, mode, config_json, plan_label, started_at, status, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      state.runId,
      state.config.mode,
      JSON.stringify(state.config),
      state.planLabel,
      state.startedAt,
      state.startedAt,
    ),
  );
}

/** 시작하지 못한 러닝을 흔적 없이 지운다(위치 점 · 구간은 외래키로 함께 지워진다). */
export async function deleteRun(runId: string): Promise<void> {
  await withWriteTransaction(async (db) => {
    await db.runAsync('DELETE FROM runs WHERE id = ?', runId);
    await db.runAsync('DELETE FROM active_run WHERE id = 1');
  });
}

/** 한 문장에 넣는 점의 수. SQLite가 한 문장에 받는 값의 수(기본 999개)를 넘지 않게 한다. */
const POINTS_PER_INSERT = 100;

async function insertPoints(db: SQLiteDatabase, runId: string, points: readonly RunPoint[]): Promise<void> {
  // 점마다 문장을 따로 실행하지 않고 묶어서 넣는다(저장이 밀렸다가 한꺼번에 들어올 때 빠르다)
  for (let start = 0; start < points.length; start += POINTS_PER_INSERT) {
    const chunk = points.slice(start, start + POINTS_PER_INSERT);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const values = chunk.flatMap((point) => [
      runId,
      point.t,
      point.lat,
      point.lng,
      point.accuracy,
      Math.round(point.elapsedMs),
    ]);
    await db.runAsync(
      `INSERT INTO run_points (run_id, t, lat, lng, accuracy, elapsed_ms) VALUES ${placeholders}`,
      values,
    );
  }
}

/**
 * 끝나지 않은 채 남은 러닝 가운데 복구용 상태(active_run)가 없는 것을 '끝남'으로 닫는다.
 * 시작 직후 첫 저장 전에 앱이 죽었거나, 시작에 실패한 러닝을 지우지 못했을 때 생긴다.
 * 그대로 두면 다시 이어 갈 방법이 없는 '진행 중' 러닝이 영영 남는다.
 */
export async function closeOrphanRuns(): Promise<void> {
  await withWriteTransaction(async (db) => {
    const active = await db.getFirstAsync<{ state_json: string }>('SELECT state_json FROM active_run WHERE id = 1');
    if (active) return;
    await db.runAsync("UPDATE runs SET status = 'finished', ended_at = updated_at WHERE status != 'finished'");
  });
}

/**
 * 러닝 중 약 1초마다 부른다. 진행 값 · 새 위치 점 · 복구용 상태를 한 트랜잭션으로 저장해서,
 * 중간에 앱이 죽어도 "점은 있는데 거리는 옛값" 같은 어긋남이 생기지 않게 한다.
 */
export async function saveProgress(args: {
  state: RunState;
  elapsedMs: number;
  points: readonly RunPoint[];
  now: number;
}): Promise<void> {
  const { state, elapsedMs, points, now } = args;
  await withWriteTransaction(async (txn) => {
    await txn.runAsync(
      'UPDATE runs SET status = ?, elapsed_ms = ?, distance_m = ?, counted = ?, updated_at = ? WHERE id = ?',
      state.status,
      Math.round(elapsedMs),
      state.distanceM,
      state.counted ? 1 : 0,
      now,
      state.runId,
    );
    await insertPoints(txn, state.runId, points);
    await txn.runAsync(
      `INSERT INTO active_run (id, state_json, saved_at) VALUES (1, ?, ?)
       ON CONFLICT (id) DO UPDATE SET state_json = excluded.state_json, saved_at = excluded.saved_at`,
      JSON.stringify(state),
      now,
    );
  });
}

/** 러닝을 끝낸 것으로 저장하고 복구용 상태를 지운다. */
export async function saveFinishedRun(summary: RunSummary, points: readonly RunPoint[]): Promise<void> {
  await withWriteTransaction(async (txn) => {
    await insertPoints(txn, summary.runId, points);
    await txn.runAsync(
      `UPDATE runs SET status = 'finished', ended_at = ?, elapsed_ms = ?, distance_m = ?,
         avg_pace_s_per_km = ?, counted = ?, sync_state = 'local', updated_at = ?
       WHERE id = ?`,
      summary.endedAt,
      Math.round(summary.elapsedMs),
      summary.distanceM,
      summary.avgPaceSecPerKm,
      summary.counted ? 1 : 0,
      summary.endedAt,
      summary.runId,
    );
    await txn.runAsync('DELETE FROM run_segments WHERE run_id = ?', summary.runId);
    for (const segment of summary.segments) {
      await txn.runAsync(
        `INSERT INTO run_segments (run_id, idx, kind, started_elapsed_ms, duration_ms, distance_m)
         VALUES (?, ?, ?, ?, ?, ?)`,
        summary.runId,
        segment.idx,
        segment.kind,
        Math.round(segment.startedElapsedMs),
        Math.round(segment.durationMs),
        segment.distanceM,
      );
    }
    await txn.runAsync('DELETE FROM active_run WHERE id = 1');
  });
}

/** 강제 종료 복구용으로 저장해 둔 계산 상태. 진행 중인 러닝이 없으면 null */
export async function loadActiveRun(): Promise<{ state: RunState; savedAt: number } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ state_json: string; saved_at: number }>(
    'SELECT state_json, saved_at FROM active_run WHERE id = 1',
  );
  if (!row) return null;
  try {
    return { state: JSON.parse(row.state_json) as RunState, savedAt: row.saved_at };
  } catch {
    // 읽을 수 없는 상태는 복구할 수 없으니 지운다. 저장된 위치 점과 진행 값은 runs · run_points에 남아 있다.
    await withWriteTransaction((writer) => writer.runAsync('DELETE FROM active_run WHERE id = 1'));
    return null;
  }
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RunRow>('SELECT * FROM runs WHERE id = ?', id);
  return row ? toRecord(row) : null;
}

export async function getRunPoints(runId: string): Promise<RunPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ t: number; lat: number; lng: number; accuracy: number | null; elapsed_ms: number }>(
    'SELECT t, lat, lng, accuracy, elapsed_ms FROM run_points WHERE run_id = ? ORDER BY id',
    runId,
  );
  return rows.map((r) => ({ t: r.t, lat: r.lat, lng: r.lng, accuracy: r.accuracy, elapsedMs: r.elapsed_ms }));
}

export async function getRunSegments(runId: string): Promise<RunSegment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    idx: number;
    kind: RunSegment['kind'];
    started_elapsed_ms: number;
    duration_ms: number;
    distance_m: number;
  }>('SELECT idx, kind, started_elapsed_ms, duration_ms, distance_m FROM run_segments WHERE run_id = ? ORDER BY idx', runId);
  return rows.map((r) => ({
    idx: r.idx,
    kind: r.kind,
    startedElapsedMs: r.started_elapsed_ms,
    durationMs: r.duration_ms,
    distanceM: r.distance_m,
  }));
}

/** 끝난 러닝을 최신순으로. from · to(epoch 밀리초, to는 포함하지 않음)를 주면 그 기간만 */
export async function listFinishedRuns(range?: { from: number; to: number }): Promise<RunRecord[]> {
  const db = await getDb();
  const rows = range
    ? await db.getAllAsync<RunRow>(
        "SELECT * FROM runs WHERE status = 'finished' AND started_at >= ? AND started_at < ? ORDER BY started_at DESC",
        range.from,
        range.to,
      )
    : await db.getAllAsync<RunRow>("SELECT * FROM runs WHERE status = 'finished' ORDER BY started_at DESC");
  return rows.map(toRecord);
}

/** 끝난 러닝의 요약 칸만 담은 모양(목표값 config는 뺐다) */
export type RunDigest = Pick<
  RunRecord,
  'id' | 'mode' | 'planLabel' | 'startedAt' | 'elapsedMs' | 'distanceM' | 'avgPaceSecPerKm' | 'counted'
>;

type DigestRow = Pick<
  RunRow,
  'id' | 'mode' | 'plan_label' | 'started_at' | 'elapsed_ms' | 'distance_m' | 'avg_pace_s_per_km' | 'counted'
>;

/**
 * 끝난 러닝 전체를 요약 칸만 읽는다(홈 · 계획 탭의 주 연속 · 회차 · 지난번 비교용).
 * 화면이 보일 때마다 부르므로 필요한 칸만 읽고, 목표값(config_json)은 읽지도 풀지도 않는다 —
 * 그 칸이 망가진 줄 하나 때문에 홈 전체가 읽기 실패가 되는 일도 막는다.
 */
export async function listRunDigests(): Promise<RunDigest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DigestRow>(
    "SELECT id, mode, plan_label, started_at, elapsed_ms, distance_m, avg_pace_s_per_km, counted FROM runs WHERE status = 'finished'",
  );
  return rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    planLabel: row.plan_label,
    startedAt: row.started_at,
    elapsedMs: row.elapsed_ms,
    distanceM: row.distance_m,
    avgPaceSecPerKm: row.avg_pace_s_per_km,
    counted: row.counted === 1,
  }));
}

/** 같은 모드로 뛴 바로 앞 기록(완료 요약 · 상세의 "지난번 비교"용) */
export async function getPreviousRunOfMode(mode: RunMode, before: number): Promise<RunRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RunRow>(
    "SELECT * FROM runs WHERE status = 'finished' AND mode = ? AND started_at < ? ORDER BY started_at DESC LIMIT 1",
    mode,
    before,
  );
  return row ? toRecord(row) : null;
}
