/** 폰 DB의 `plan_items` 줄을 주간 계획으로 바꾸는 순수 함수(db/planRepo가 쓴다). */
import { isRunConfig } from './settings';
import type { PlanItem, RunConfig } from './types';
import { DAYS_PER_WEEK } from './week';

/** `plan_items` 테이블 한 줄(DB에서 읽은 그대로) */
export type PlanRow = { weekday: number; mode: string; config_json: string; label: string };

/**
 * DB에서 읽은 줄을 계획으로 바꾼다. 쓸 수 없는 줄은 건너뛴다:
 * 요일이 0~6이 아닌 줄, 목표값이 깨졌거나 모양이 틀린 줄, 모드와 목표값이 어긋난 줄.
 * 그런 줄을 그대로 쓰면 홈의 문구가 깨지거나 러닝을 시작할 때 오류가 난다.
 */
export function parsePlanRows(rows: readonly PlanRow[]): PlanItem[] {
  const items: PlanItem[] = [];
  for (const row of rows) {
    if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday >= DAYS_PER_WEEK) continue;
    const config = parseConfig(row.config_json);
    if (config && config.mode === row.mode) items.push({ weekday: row.weekday, mode: config.mode, config, label: row.label });
  }
  return items.sort((a, b) => a.weekday - b.weekday);
}

function parseConfig(json: string): RunConfig | null {
  try {
    const value: unknown = JSON.parse(json);
    return isRunConfig(value) ? value : null;
  } catch {
    return null;
  }
}
