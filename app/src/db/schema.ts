/**
 * 폰 DB 스키마. overview/data-model.md "폰 (SQLite)" 표와 같아야 한다.
 * 스키마를 바꿀 때는 기존 문장을 고치지 말고 MIGRATIONS 끝에 새 항목을 추가한다
 * (이미 설치된 앱은 앞 단계가 적용된 상태이기 때문).
 */
export const MIGRATIONS: readonly string[] = [
  // 1: 최초 스키마
  `
  CREATE TABLE runs (
    id TEXT PRIMARY KEY NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('free', 'interval', 'cadence', 'pacemaker')),
    config_json TEXT NOT NULL,
    plan_label TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'finished')),
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    distance_m REAL NOT NULL DEFAULT 0,
    avg_pace_s_per_km REAL,
    counted INTEGER NOT NULL DEFAULT 0 CHECK (counted IN (0, 1)),
    sync_state TEXT NOT NULL DEFAULT 'local' CHECK (sync_state IN ('local', 'synced')),
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_runs_started_at ON runs (started_at DESC);
  CREATE INDEX idx_runs_sync_state ON runs (sync_state);

  CREATE TABLE run_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    t INTEGER NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    accuracy REAL,
    elapsed_ms INTEGER NOT NULL
  );
  CREATE INDEX idx_run_points_run_id ON run_points (run_id, id);

  CREATE TABLE run_segments (
    run_id TEXT NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('run', 'walk', 'km')),
    started_elapsed_ms INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    distance_m REAL NOT NULL,
    PRIMARY KEY (run_id, idx)
  );

  CREATE TABLE plan_items (
    weekday INTEGER PRIMARY KEY NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    mode TEXT NOT NULL CHECK (mode IN ('free', 'interval', 'cadence', 'pacemaker')),
    config_json TEXT NOT NULL,
    label TEXT NOT NULL
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];
