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

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
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
  return db;
}
