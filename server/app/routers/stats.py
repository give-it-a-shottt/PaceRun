"""웹 대시보드용 통계."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas.stats import StatsOut
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
    return StatsOut.model_validate(stats_service.get_stats(db, user, period, anchor, tz))
