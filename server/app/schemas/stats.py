"""통계 응답 모양(overview/api-list.md "통계")."""

from datetime import date
from typing import Literal

from pydantic import BaseModel


class BucketOut(BaseModel):
    label: str
    start: date
    distance_m: float
    count: int
    elapsed_s: int


class TotalsOut(BaseModel):
    distance_m: float
    count: int
    elapsed_s: int


class GoalWeeksOut(BaseModel):
    achieved: int
    total: int


class StatsOut(BaseModel):
    period: Literal["month", "year"]
    start: date
    end: date
    buckets: list[BucketOut]
    totals: TotalsOut
    goal_weeks: GoalWeeksOut
    weekly_goal: int
