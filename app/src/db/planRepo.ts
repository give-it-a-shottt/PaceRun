import { isRunConfig } from '@/domain/settings';
import type { PlanItem, RunMode } from '@/domain/types';

import { getDb } from './database';

type PlanRow = { weekday: number; mode: RunMode; config_json: string; label: string };

/** 주간 계획(요일당 운동 1개)을 월요일부터 순서대로 읽는다. 목표값이 망가진 줄은 건너뛴다. */
export async function listPlanItems(): Promise<PlanItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PlanRow>('SELECT weekday, mode, config_json, label FROM plan_items ORDER BY weekday');
  const items: PlanItem[] = [];
  for (const row of rows) {
    const config = parseConfig(row.config_json);
    // 모드와 목표값의 모양이 어긋난 줄을 그대로 쓰면 러닝을 시작할 때 오류가 난다
    if (config && config.mode === row.mode) items.push({ weekday: row.weekday, mode: row.mode, config, label: row.label });
  }
  return items;
}

function parseConfig(json: string) {
  try {
    const value: unknown = JSON.parse(json);
    return isRunConfig(value) ? value : null;
  } catch {
    return null;
  }
}
