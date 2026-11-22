import { parsePlanRows, type PlanRow } from '@/domain/planRows';
import type { PlanItem } from '@/domain/types';

import { getDb, withWriteTransaction } from './database';

const SELECT_PLAN = 'SELECT weekday, mode, config_json, label FROM plan_items ORDER BY weekday';

/** 주간 계획(요일당 운동 1개)을 월요일부터 순서대로 읽는다. 쓸 수 없는 줄은 건너뛴다(domain/planRows의 parsePlanRows). */
export async function listPlanItems(): Promise<PlanItem[]> {
  const db = await getDb();
  return parsePlanRows(await db.getAllAsync<PlanRow>(SELECT_PLAN));
}

/**
 * 계획을 고친다: 지금 계획을 읽어 change에 넘기고, 돌려받은 새 계획으로 바꿔 넣는다.
 * 요일 하나 넣기 · 비우기, 템플릿 적용이 모두 이 함수로 저장한다.
 *
 * - 읽기와 쓰기를 한 트랜잭션에 묶는다. 읽기를 밖에서 하면 저장 두 개가 겹쳤을 때 둘 다 옛 계획을 읽어
 *   한쪽 변경이 사라진다. 중간에 실패하면 트랜잭션이 되돌려져 원래 계획이 그대로 남는다.
 * - 새 계획의 줄을 먼저 넣고(같은 요일은 바꿔 넣기) 빠진 요일을 나중에 지운다. 다 지우고 다시 넣으면
 *   그 사이에 계획을 읽은 화면이 잠깐 "계획 없음"을 보게 된다.
 * - 읽을 수 없어 건너뛴 줄(목표값이 깨진 줄)은 새 계획에 없으므로 이때 함께 지워진다.
 */
export async function updatePlan(change: (current: PlanItem[]) => readonly PlanItem[]): Promise<void> {
  await withWriteTransaction(async (db) => {
    const next = change(parsePlanRows(await db.getAllAsync<PlanRow>(SELECT_PLAN)));
    for (const planned of next) {
      await db.runAsync(
        'INSERT OR REPLACE INTO plan_items (weekday, mode, config_json, label) VALUES (?, ?, ?, ?)',
        planned.weekday,
        planned.mode,
        JSON.stringify(planned.config),
        planned.label,
      );
    }
    const kept = next.map((planned) => planned.weekday);
    if (kept.length === 0) {
      // 빈 목록으로는 NOT IN ()을 쓸 수 없다(SQL 문법 오류). 남길 요일이 없으면 전부 지운다.
      await db.runAsync('DELETE FROM plan_items');
      return;
    }
    // 남길 요일 수만큼 자리 표시(?)를 만든다
    const holes = kept.map(() => '?').join(', ');
    await db.runAsync(`DELETE FROM plan_items WHERE weekday NOT IN (${holes})`, ...kept);
  });
}
