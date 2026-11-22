import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrate';
import { MIGRATIONS } from './schema';

const DATABASE_NAME = 'pacerun.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * 앱 전체가 함께 쓰는 DB 연결. 화면(React)뿐 아니라 화면 밖에서 도는
 * 위치 기록 작업도 같은 연결을 써야 해서 Provider가 아니라 모듈 단위로 둔다.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((error) => {
      // 실패한 약속을 붙들고 있으면 다시 시도할 수 없다
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

let writeLock: Promise<unknown> = Promise.resolve();

/**
 * 쓰기 여러 개를 "전부 되거나 전부 안 되게" 묶는다. 한 번에 하나씩만 돈다.
 *
 * expo-sqlite의 withExclusiveTransactionAsync는 부를 때마다 DB 연결을 새로 열고 닫아서
 * 러닝 중 1초마다 쓰기에는 무겁고, 새 연결에는 foreign_keys 설정도 걸리지 않는다.
 * 그래서 늘 쓰는 연결에서 트랜잭션을 열되, 다른 쓰기가 그 사이에 끼어들지 않게 여기서 줄을 세운다.
 * (앱의 모든 쓰기는 이 함수를 거친다.)
 */
export function withWriteTransaction<T>(task: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = writeLock.then(async () => {
    const db = await getDb();
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
    return result;
  });
  // 앞 작업이 실패해도 다음 작업은 돌아야 한다
  writeLock = run.catch(() => undefined);
  return run;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  try {
    await applyMigrations(db);
  } catch (error) {
    // 실패한 채로 두면 '다시 시도' 때마다 연결이 하나씩 쌓인다
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
  return db;
}

async function applyMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await runMigrations(
    {
      getVersion: async () => {
        const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        return row?.user_version ?? 0;
      },
      // 한 단계는 전부 되거나 전부 안 되게 트랜잭션으로 묶는다
      applyStep: (sql, version) =>
        db.withExclusiveTransactionAsync(async (txn) => {
          await txn.execAsync(sql);
          await txn.execAsync(`PRAGMA user_version = ${version}`);
        }),
    },
    MIGRATIONS,
  );
}
