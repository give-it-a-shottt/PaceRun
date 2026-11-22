import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withoutWorkout, withWorkout } from '@/domain/plan';
import type { PlanRow } from '@/domain/planRows';
import type { PlanItem } from '@/domain/types';

// expo-sqlite는 폰에서만 돈다. plan_items 표 하나를 메모리에 흉내 낸 가짜 DB로
// "읽기와 쓰기가 한 트랜잭션에 묶이는지, 실패하면 원래대로 남는지, 겹친 저장이 서로를 지우지 않는지"를 본다.
let rows: PlanRow[] = [];
/** n번째 쓰기(runAsync)에서 실패하게 한다. 0이면 실패하지 않는다. */
let failOnWrite = 0;
let writes = 0;

const fakeDb = {
  execAsync: vi.fn(async () => undefined),
  getFirstAsync: vi.fn(async () => ({ user_version: 99 })),
  closeAsync: vi.fn(async () => undefined),
  getAllAsync: vi.fn(async () => {
    // 실제 DB처럼 읽는 데 잠깐 걸리게 해서, 줄을 세우지 않으면 저장 두 개가 같은 옛 값을 읽게 만든다
    await new Promise((resolve) => setTimeout(resolve, 1));
    return rows.map((row) => ({ ...row })).sort((a, b) => a.weekday - b.weekday);
  }),
  runAsync: vi.fn(async (sql: string, ...params: unknown[]) => {
    writes += 1;
    if (writes === failOnWrite) throw new Error('disk full');
    if (sql.startsWith('INSERT OR REPLACE INTO plan_items')) {
      const [weekday, mode, config_json, label] = params as [number, string, string, string];
      rows = [...rows.filter((row) => row.weekday !== weekday), { weekday, mode, config_json, label }];
    } else if (sql === 'DELETE FROM plan_items') {
      rows = [];
    } else if (sql.startsWith('DELETE FROM plan_items WHERE weekday NOT IN (?')) {
      rows = rows.filter((row) => params.includes(row.weekday));
    } else {
      throw new Error(`가짜 DB가 모르는 SQL: ${sql}`);
    }
  }),
  withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
    const before = rows.map((row) => ({ ...row }));
    try {
      await task();
    } catch (error) {
      rows = before;
      throw error;
    }
  }),
};
vi.mock('expo-sqlite', () => ({ openDatabaseAsync: vi.fn(async () => fakeDb) }));

const INTERVAL = { mode: 'interval', runSec: 60, walkSec: 90, repeats: 8 } as const;
const CADENCE = { mode: 'cadence', spm: 170, durationSec: 1200 } as const;

function row(weekday: number, label = '인터벌 입문'): PlanRow {
  return { weekday, mode: 'interval', config_json: JSON.stringify(INTERVAL), label };
}

async function load() {
  vi.resetModules();
  return import('./planRepo');
}

beforeEach(() => {
  rows = [row(0), row(3), row(5)];
  failOnWrite = 0;
  writes = 0;
  vi.clearAllMocks();
});

describe('계획 읽기', () => {
  it('요일 순으로 읽고, 쓸 수 없는 줄은 건너뛴다', async () => {
    rows = [row(5), { weekday: 1, mode: 'interval', config_json: '{깨짐', label: 'x' }, row(0)];
    const { listPlanItems } = await load();
    expect((await listPlanItems()).map((planned) => planned.weekday)).toEqual([0, 5]);
  });
});

describe('계획 고치기', () => {
  it('요일 하나를 넣으면 그 줄만 생기고 나머지는 그대로다', async () => {
    const { updatePlan, listPlanItems } = await load();

    await updatePlan((plan) => withWorkout(plan, 1, CADENCE));

    const plan = await listPlanItems();
    expect(plan.map((planned) => [planned.weekday, planned.mode])).toEqual([
      [0, 'interval'],
      [1, 'cadence'],
      [3, 'interval'],
      [5, 'interval'],
    ]);
    expect(plan[1].label).toBe('발걸음 박자');
  });

  it('있던 요일을 바꾸면 줄 수가 늘지 않는다', async () => {
    const { updatePlan, listPlanItems } = await load();
    await updatePlan((plan) => withWorkout(plan, 3, CADENCE));
    const plan = await listPlanItems();
    expect(plan).toHaveLength(3);
    expect(plan[1]).toMatchObject({ weekday: 3, mode: 'cadence' });
  });

  it('요일을 비우면 그 줄만 지워진다', async () => {
    const { updatePlan, listPlanItems } = await load();
    await updatePlan((plan) => withoutWorkout(plan, 3));
    expect((await listPlanItems()).map((planned) => planned.weekday)).toEqual([0, 5]);
  });

  it('마지막 남은 운동을 비우면 계획이 빈다(빈 목록으로 지우는 문장을 따로 쓴다)', async () => {
    rows = [row(2)];
    const { updatePlan, listPlanItems } = await load();
    await updatePlan((plan) => withoutWorkout(plan, 2));
    expect(await listPlanItems()).toEqual([]);
  });

  it('템플릿으로 통째로 바꾸면 새 계획에 없는 요일은 지워진다', async () => {
    const { updatePlan, listPlanItems } = await load();
    const template: PlanItem[] = [1, 3, 6].map((weekday) => ({ weekday, mode: 'cadence', config: CADENCE, label: '발걸음 박자 연습' }));

    await updatePlan(() => template);

    expect((await listPlanItems()).map((planned) => [planned.weekday, planned.label])).toEqual([
      [1, '발걸음 박자 연습'],
      [3, '발걸음 박자 연습'],
      [6, '발걸음 박자 연습'],
    ]);
  });

  it('읽기와 쓰기를 한 트랜잭션 안에서 한다', async () => {
    const { updatePlan } = await load();
    await updatePlan((plan) => withWorkout(plan, 1, CADENCE));
    expect(fakeDb.withTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('저장하다 중간에 실패하면 오류를 알리고 원래 계획이 그대로 남는다', async () => {
    const { updatePlan, listPlanItems } = await load();
    const before = rows.map((existing) => ({ ...existing }));
    failOnWrite = 2; // 첫 줄은 들어가고 둘째 줄에서 실패

    const template: PlanItem[] = [1, 2, 6].map((weekday) => ({ weekday, mode: 'cadence', config: CADENCE, label: '발걸음 박자 연습' }));
    await expect(updatePlan(() => template)).rejects.toThrow('disk full');

    expect(rows).toEqual(before);
    expect((await listPlanItems()).map((planned) => planned.weekday)).toEqual([0, 3, 5]);
  });

  it('실패한 뒤에도 다음 저장은 된다', async () => {
    const { updatePlan, listPlanItems } = await load();
    failOnWrite = 1;
    await expect(updatePlan((plan) => withWorkout(plan, 1, CADENCE))).rejects.toThrow();
    failOnWrite = 0;

    await updatePlan((plan) => withWorkout(plan, 1, CADENCE));
    expect((await listPlanItems()).map((planned) => planned.weekday)).toEqual([0, 1, 3, 5]);
  });

  it('저장 두 개가 겹쳐도 둘 다 반영된다(나중 저장이 옛 계획으로 덮어쓰지 않는다)', async () => {
    const { updatePlan, listPlanItems } = await load();

    await Promise.all([
      updatePlan((plan) => withWorkout(plan, 1, CADENCE)),
      updatePlan((plan) => withoutWorkout(plan, 5)),
    ]);

    expect((await listPlanItems()).map((planned) => planned.weekday)).toEqual([0, 1, 3]);
  });

  it('읽을 수 없어 건너뛴 줄은 저장하면서 지워진다', async () => {
    rows = [row(0), { weekday: 4, mode: 'interval', config_json: '{깨짐', label: 'x' }];
    const { updatePlan } = await load();
    await updatePlan((plan) => withWorkout(plan, 1, CADENCE));
    expect(rows.map((existing) => existing.weekday).sort()).toEqual([0, 1]);
  });
});
