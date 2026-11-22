"""통계 응답 모양(overview/api-list.md "통계"). 서비스가 돌려주는 값과 칸 이름이 같다."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

# 통계를 묶는 기간. 요청(쿼리) · 서비스 · 응답이 이 한 곳의 정의를 함께 쓴다.
Period = Literal["month", "year"]


class _FromService(BaseModel):
    # 서비스의 dataclass에서 같은 이름의 칸을 읽어 만든다
    model_config = ConfigDict(from_attributes=True)


class BucketOut(_FromService):
    label: str
    start: date
    distance_m: float
    count: int
    elapsed_s: int


class TotalsOut(_FromService):
    distance_m: float
    count: int
    elapsed_s: int


class GoalWeeksOut(_FromService):
    achieved: int
    total: int


class StatsOut(_FromService):
    period: Period
    start: date
    end: date
    buckets: list[BucketOut]
    totals: TotalsOut
    goal_weeks: GoalWeeksOut
    weekly_goal: int
