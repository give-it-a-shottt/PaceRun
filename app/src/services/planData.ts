import { listPlanItems, replacePlan } from '@/db/planRepo';
import { listRunDigests } from '@/db/runsRepo';
import { describePlan, withoutWorkout, withWorkout, type PlanTemplate, type PlanView } from '@/domain/plan';
import type { RunConfig } from '@/domain/types';

export type { PlanDayView, PlanTemplate, PlanView, TemplateDayView } from '@/domain/plan';

/** 계획 탭에 그릴 값: 폰 DB에서 계획과 끝난 러닝(완료 표시 · 회차용)을 읽어 계산 함수에 넘긴다. */
export async function loadPlan(now: number): Promise<PlanView> {
  const [plan, runs] = await Promise.all([listPlanItems(), listRunDigests()]);
  return describePlan({ now, plan, runs });
}

/** 계획이 하나라도 있는지(템플릿을 적용하기 전에 "지금 계획을 바꿀까요?"를 물을지 정할 때 쓴다) */
export async function hasPlan(): Promise<boolean> {
  return (await listPlanItems()).length > 0;
}

/** 그 요일에 운동을 넣거나 바꾼다. */
export async function saveWorkout(weekday: number, config: RunConfig): Promise<void> {
  await replacePlan(withWorkout(await listPlanItems(), weekday, config));
}

/** 그 요일을 비운다. */
export async function removeWorkout(weekday: number): Promise<void> {
  await replacePlan(withoutWorkout(await listPlanItems(), weekday));
}

/** 템플릿으로 계획 전체를 바꾼다(있던 계획은 지워진다). */
export async function applyTemplate(template: PlanTemplate): Promise<void> {
  await replacePlan(template.items);
}
