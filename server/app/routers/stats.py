"""웹 대시보드용 통계."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas.stats import BucketOut, GoalWeeksOut, StatsOut, TotalsOut
from app.services import stats_service
from app.services.stats_service import DEFAULT_TZ, Period

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
def get_stats(
    user: CurrentUser,
    db: DbSession,
    period: Period = "month",
    anchor: date | None = None,
    tz: Annotated[str, Query(max_length=64)] = DEFAULT_TZ,
) -> StatsOut:
    stats = stats_service.get_stats(db, user, period, anchor, tz)
    return StatsOut(
        period=stats.period,
        start=stats.start,
        end=stats.end,
        buckets=[
            BucketOut(
                label=bucket.label,
                start=bucket.start,
                distance_m=bucket.distance_m,
                count=bucket.count,
                elapsed_s=bucket.elapsed_s,
            )
            for bucket in stats.buckets
        ],
        totals=TotalsOut(distance_m=stats.total_distance_m, count=stats.total_count, elapsed_s=stats.total_elapsed_s),
        goal_weeks=GoalWeeksOut(achieved=stats.goal_weeks_achieved, total=stats.goal_weeks_total),
        weekly_goal=stats.weekly_goal,
    )
