/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { MIGRATIONS } from './schema';

// 폰의 expo-sqlite 대신 Node에 들어 있는 SQLite로 같은 SQL을 돌려, 스키마와 제약이 뜻대로 걸리는지 본다.
function createDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of MIGRATIONS) db.exec(sql);
  return db;
}

const RUN_INSERT = `INSERT INTO runs (id, mode, config_json, started_at, status, updated_at)
  VALUES (?, ?, '{}', 1000, ?, 1000)`;

describe('폰 DB 스키마', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDb();
  });

  it('테이블 6개를 만든다', () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);
    expect(names).toEqual(['active_run', 'plan_items', 'run_points', 'run_segments', 'runs', 'settings']);
  });

  it('러닝을 넣으면 기본값이 채워진다', () => {
    db.prepare(RUN_INSERT).run('run-1', 'free', 'active');
    const row = db.prepare('SELECT * FROM runs WHERE id = ?').get('run-1');
    expect(row).toMatchObject({ elapsed_ms: 0, distance_m: 0, counted: 0, sync_state: 'local', ended_at: null });
  });

  it('모르는 모드와 상태는 거절한다', () => {
    expect(() => db.prepare(RUN_INSERT).run('run-1', 'swim', 'active')).toThrow(/CHECK constraint/);
    expect(() => db.prepare(RUN_INSERT).run('run-2', 'free', 'done')).toThrow(/CHECK constraint/);
  });

  it('같은 러닝 번호를 두 번 넣을 수 없다', () => {
    db.prepare(RUN_INSERT).run('run-1', 'free', 'active');
    expect(() => db.prepare(RUN_INSERT).run('run-1', 'free', 'active')).toThrow(/UNIQUE constraint/);
  });

  it('인정 여부와 동기화 상태는 정해진 값만 받는다', () => {
    db.prepare(RUN_INSERT).run('run-1', 'free', 'active');
    expect(() => db.prepare('UPDATE runs SET counted = 2 WHERE id = ?').run('run-1')).toThrow(/CHECK constraint/);
    expect(() => db.prepare("UPDATE runs SET sync_state = 'queued' WHERE id = ?").run('run-1')).toThrow(
      /CHECK constraint/,
    );
  });

  it('구간은 종류가 정해져 있고, 한 러닝 안에서 순번이 겹칠 수 없다', () => {
    db.prepare(RUN_INSERT).run('run-1', 'interval', 'active');
    const insert = db.prepare(
      'INSERT INTO run_segments (run_id, idx, kind, started_elapsed_ms, duration_ms, distance_m) VALUES (?, ?, ?, 0, 60000, 150)',
    );
    insert.run('run-1', 0, 'run');
    expect(() => insert.run('run-1', 0, 'walk')).toThrow(/UNIQUE constraint/);
    expect(() => insert.run('run-1', 1, 'sprint')).toThrow(/CHECK constraint/);
  });

  it('없는 러닝의 위치 점은 넣을 수 없다', () => {
    const insert = db.prepare('INSERT INTO run_points (run_id, t, lat, lng, elapsed_ms) VALUES (?, 1, 37.5, 127.0, 0)');
    expect(() => insert.run('no-run')).toThrow(/FOREIGN KEY constraint/);
  });

  it('러닝을 지우면 위치 점과 구간도 함께 지워진다', () => {
    db.prepare(RUN_INSERT).run('run-1', 'interval', 'finished');
    db.prepare('INSERT INTO run_points (run_id, t, lat, lng, elapsed_ms) VALUES (?, 1, 37.5, 127.0, 0)').run('run-1');
    db.prepare(
      "INSERT INTO run_segments (run_id, idx, kind, started_elapsed_ms, duration_ms, distance_m) VALUES (?, 0, 'run', 0, 60000, 150)",
    ).run('run-1');

    db.prepare('DELETE FROM runs WHERE id = ?').run('run-1');

    expect(db.prepare('SELECT COUNT(*) AS n FROM run_points').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM run_segments').get()).toEqual({ n: 0 });
  });

  it('진행 중인 러닝의 복구용 상태는 한 줄만 둘 수 있다', () => {
    const insert = db.prepare("INSERT INTO active_run (id, state_json, saved_at) VALUES (?, '{}', 1000)");
    insert.run(1);
    expect(() => insert.run(2)).toThrow(/CHECK constraint/);
    // 같은 줄을 덮어쓰는 것은 된다(러닝 중 1초마다 이렇게 저장한다)
    db.prepare(
      `INSERT INTO active_run (id, state_json, saved_at) VALUES (1, '{"a":1}', 2000)
       ON CONFLICT (id) DO UPDATE SET state_json = excluded.state_json, saved_at = excluded.saved_at`,
    ).run();
    expect(db.prepare('SELECT state_json, saved_at FROM active_run').all()).toEqual([
      { state_json: '{"a":1}', saved_at: 2000 },
    ]);
  });

  it('계획은 요일(0~6)당 하나만 둘 수 있다', () => {
    const insert = db.prepare("INSERT INTO plan_items (weekday, mode, config_json, label) VALUES (?, 'free', '{}', '자유')");
    insert.run(0);
    expect(() => insert.run(0)).toThrow(/UNIQUE constraint/);
    expect(() => insert.run(7)).toThrow(/CHECK constraint/);
  });
});
