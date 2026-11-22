import { parsePlanRows, type PlanRow } from '@/domain/planRows';
import type { PlanItem } from '@/domain/types';

import { getDb, withWriteTransaction } from './database';

/** 주간 계획(요일당 운동 1개)을 월요일부터 순서대로 읽는다. 쓸 수 없는 줄은 건너뛴다(domain/planRows의 parsePlanRows). */
export async function listPlanItems(): Promise<PlanItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlanRow>('SELECT weekday, mode, config_json, label FROM plan_items ORDER BY weekday');
  return parsePlanRows(rows);
}

/**
 * 계획 전체를 새 계획으로 바꾼다(템플릿 적용, 요일 하나 고치기 · 비우기 모두 이 함수로 저장한다).
 * 지우기와 넣기를 한 트랜잭션으로 묶어, 중간에 실패하면 원래 계획이 그대로 남는다.
 */
export async function replacePlan(items: readonly PlanItem[]): Promise<void> {
  await withWriteTransaction(async (db) => {
    await db.runAsync('DELETE FROM plan_items');
    for (const planned of items) {
      await db.runAsync(
        'INSERT INTO plan_items (weekday, mode, config_json, label) VALUES (?, ?, ?, ?)',
        planned.weekday,
        planned.mode,
        JSON.stringify(planned.config),
        planned.label,
      );
    }
  });
}
