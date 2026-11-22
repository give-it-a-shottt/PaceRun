/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { runMigrations, type MigrationTarget } from './migrate';
import { MIGRATIONS } from './schema';

/** 폰의 database.ts와 같은 방식(한 단계 = 한 트랜잭션)으로 Node SQLite에 적용하는 대상 */
function nodeTarget(db: DatabaseSync): MigrationTarget {
  return {
    getVersion: async () => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    applyStep: async (sql, version) => {
      db.exec('BEGIN');
      try {
        db.exec(sql);
        db.exec(`PRAGMA user_version = ${version}`);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function tableNames(db: DatabaseSync): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name));
}

describe('runMigrations', () => {
  it('빈 DB에 모든 단계를 적용하고 단계 수를 기록한다', async () => {
    const db = new DatabaseSync(':memory:');
    const target = nodeTarget(db);
    await runMigrations(target, MIGRATIONS);
    expect(await target.getVersion()).toBe(MIGRATIONS.length);
    expect(tableNames(db)).toContain('runs');
  });

  it('두 번 실행해도 이미 적용한 단계는 다시 적용하지 않는다', async () => {
    const db = new DatabaseSync(':memory:');
    const target = nodeTarget(db);
    await runMigrations(target, MIGRATIONS);
    // 다시 적용하면 CREATE TABLE이 "이미 있음"으로 실패할 것이다
    await expect(runMigrations(target, MIGRATIONS)).resolves.toBeUndefined();
  });

  it('나중에 추가된 단계만 이어서 적용한다', async () => {
    const db = new DatabaseSync(':memory:');
    const target = nodeTarget(db);
    const steps = ['CREATE TABLE a (id INTEGER)', 'CREATE TABLE b (id INTEGER)'];
    await runMigrations(target, steps.slice(0, 1));
    expect(tableNames(db)).toEqual(['a']);
    await runMigrations(target, steps);
    expect(tableNames(db)).toEqual(['a', 'b']);
    expect(await target.getVersion()).toBe(2);
  });

  it('중간 단계가 실패하면 그 단계는 흔적 없이 되돌리고, 다음 실행 때 그 단계부터 다시 시도한다', async () => {
    const db = new DatabaseSync(':memory:');
    const target = nodeTarget(db);
    const broken = ['CREATE TABLE a (id INTEGER)', 'CREATE TABLE b (id INTEGER); 이건 SQL이 아님;'];

    await expect(runMigrations(target, broken)).rejects.toThrow();
    expect(await target.getVersion()).toBe(1);
    expect(tableNames(db)).toEqual(['a']);

    const fixed = [broken[0], 'CREATE TABLE b (id INTEGER)'];
    await runMigrations(target, fixed);
    expect(tableNames(db)).toEqual(['a', 'b']);
  });
});
