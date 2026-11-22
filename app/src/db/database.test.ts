import { beforeEach, describe, expect, it, vi } from 'vitest';

// expo-sqlite는 폰에서만 돈다. 여기서는 "쓰기를 한 줄로 세우는지"와 "실패가 다음 쓰기를 막지 않는지"만 보려고
// 트랜잭션을 흉내 내는 가짜 DB를 끼운다. SQL 자체는 schema · migrate 테스트와 에뮬레이터 실행으로 확인한다.
const log: string[] = [];
const fakeDb = {
  execAsync: vi.fn(async () => undefined),
  getFirstAsync: vi.fn(async () => ({ user_version: 99 })),
  withExclusiveTransactionAsync: vi.fn(),
  closeAsync: vi.fn(async () => undefined),
  withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
    log.push('BEGIN');
    try {
      await task();
      log.push('COMMIT');
    } catch (error) {
      log.push('ROLLBACK');
      throw error;
    }
  }),
};
vi.mock('expo-sqlite', () => ({ openDatabaseAsync: vi.fn(async () => fakeDb) }));

async function load() {
  vi.resetModules();
  return import('./database');
}

/** 잠깐 쉬었다 끝나는 쓰기. 줄을 세우지 않으면 서로 끼어든다. */
function slowWrite(name: string) {
  return async () => {
    log.push(`${name} 시작`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    log.push(`${name} 끝`);
    return name;
  };
}

beforeEach(() => {
  log.length = 0;
  vi.clearAllMocks();
});

describe('withWriteTransaction', () => {
  it('동시에 불러도 한 번에 하나씩, 부른 순서대로 돈다', async () => {
    const { withWriteTransaction } = await load();

    const results = await Promise.all([
      withWriteTransaction(slowWrite('가')),
      withWriteTransaction(slowWrite('나')),
      withWriteTransaction(slowWrite('다')),
    ]);

    expect(results).toEqual(['가', '나', '다']);
    expect(log).toEqual([
      'BEGIN', '가 시작', '가 끝', 'COMMIT',
      'BEGIN', '나 시작', '나 끝', 'COMMIT',
      'BEGIN', '다 시작', '다 끝', 'COMMIT',
    ]);
  });

  it('한 쓰기가 실패하면 그 쓰기만 되돌리고, 다음 쓰기는 그대로 돈다', async () => {
    const { withWriteTransaction } = await load();

    const failed = withWriteTransaction(async () => {
      log.push('실패하는 쓰기');
      throw new Error('disk full');
    });
    const next = withWriteTransaction(slowWrite('다음'));

    await expect(failed).rejects.toThrow('disk full');
    await expect(next).resolves.toBe('다음');
    expect(log).toEqual(['BEGIN', '실패하는 쓰기', 'ROLLBACK', 'BEGIN', '다음 시작', '다음 끝', 'COMMIT']);
  });

  it('러닝 중 쓰기에는 매번 새 연결을 여는 방식(exclusive)을 쓰지 않는다', async () => {
    const { withWriteTransaction } = await load();
    await withWriteTransaction(slowWrite('가'));
    expect(fakeDb.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});

describe('getDb', () => {
  it('여러 곳에서 불러도 DB는 한 번만 연다', async () => {
    const sqlite = await import('expo-sqlite');
    const { getDb } = await load();

    const [first, second] = await Promise.all([getDb(), getDb()]);

    expect(first).toBe(second);
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('열다가 실패하면 연결을 닫고, 다음에 부르면 다시 연다', async () => {
    const sqlite = await import('expo-sqlite');
    const { getDb } = await load();
    fakeDb.getFirstAsync.mockRejectedValueOnce(new Error('corrupt'));

    await expect(getDb()).rejects.toThrow('corrupt');
    expect(fakeDb.closeAsync).toHaveBeenCalledTimes(1);

    await expect(getDb()).resolves.toBe(fakeDb);
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });
});
