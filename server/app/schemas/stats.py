"""통계 응답 모양(overview/api-list.md "통계"). 서비스가 돌려주는 값과 칸 이름이 같다."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


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
    period: Literal["month", "year"]
    start: date
    end: date
    buckets: list[BucketOut]
    totals: TotalsOut
    goal_weeks: GoalWeeksOut
    weekly_goal: int
