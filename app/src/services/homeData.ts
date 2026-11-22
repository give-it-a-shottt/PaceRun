import { listPlanItems } from '@/db/planRepo';
import { listFinishedRuns } from '@/db/runsRepo';
import { describeHome, type HomeView } from '@/domain/home';

export type { HomeView, TodayCard } from '@/domain/home';
export type { WeekCellView } from '@/domain/weekProgress';

/**
 * 홈 화면에 그릴 값을 만든다: 폰 DB에서 계획과 끝난 러닝을 읽어 계산 함수에 넘긴다.
 * 러닝 전체를 읽는 것은 주 연속 · 회차 · 지난번 비교가 오래된 기록까지 보기 때문이다
 * (한 사람이 쓰는 앱이라 몇 년 치도 수천 줄을 넘지 않는다).
 */
export async function loadHome(now: number, weeklyGoal: number): Promise<HomeView> {
  const [plan, runs] = await Promise.all([listPlanItems(), listFinishedRuns()]);
  return describeHome({ now, weeklyGoal, plan, runs });
}
