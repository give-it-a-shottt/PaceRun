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

  it('테이블 5개를 만든다', () => {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);
    expect(names).toEqual(['plan_items', 'run_points', 'run_segments', 'runs', 'settings']);
  });

  it('러닝을 넣으면 기본값이 채워진다', () => {
    db.prepare(RUN_INSERT).run('run-1', 'free', 'active');
    const row = db.prepare('SELECT * FROM runs WHERE id = ?').get('run-1');
    expect(row).toMatchObject({ elapsed_ms: 0, distance_m: 0, counted: 0, sync_state: 'local', ended_at: null });
  });

  it('모르는 모드와 상태는 거절한다', () => {
    expect(() => db.prepare(RUN_INSERT).run('run-1', 'swim', 'active')).toThrow();
    expect(() => db.prepare(RUN_INSERT).run('run-2', 'free', 'done')).toThrow();
  });

  it('같은 러닝 번호를 두 번 넣을 수 없다', () => {
    db.prepare(RUN_INSERT).run('run-1', 'free', 'active');
    expect(() => db.prepare(RUN_INSERT).run('run-1', 'free', 'active')).toThrow();
  });

  it('없는 러닝의 위치 점은 넣을 수 없다', () => {
    const insert = db.prepare('INSERT INTO run_points (run_id, t, lat, lng, elapsed_ms) VALUES (?, 1, 37.5, 127.0, 0)');
    expect(() => insert.run('no-run')).toThrow();
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

  it('계획은 요일(0~6)당 하나만 둘 수 있다', () => {
    const insert = db.prepare("INSERT INTO plan_items (weekday, mode, config_json, label) VALUES (?, 'free', '{}', '자유')");
    insert.run(0);
    expect(() => insert.run(0)).toThrow();
    expect(() => insert.run(7)).toThrow();
  });
});
