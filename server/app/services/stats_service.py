"""웹 대시보드용 통계: 기간(월 · 년) 안의 날짜별 / 월별 합계와 주 목표 달성 주 수.

"하루"와 "한 주(월요일 0시 시작)"는 사용자의 시간대로 나눈다. 서버 시각(UTC)으로 나누면
한국에서 아침 7시에 뛴 기록이 전날로 잡힌다.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import status
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Run, User

Period = Literal["month", "year"]
DEFAULT_TZ = "Asia/Seoul"


@dataclass(frozen=True)
class Bucket:
    label: str
    start: date
    distance_m: float
    count: int
    elapsed_s: int


@dataclass(frozen=True)
class Stats:
    period: Period
    start: date
    end: date
    buckets: list[Bucket]
    total_distance_m: float
    total_count: int
    total_elapsed_s: int
    goal_weeks_achieved: int
    goal_weeks_total: int
    weekly_goal: int


def get_stats(db: Session, user: User, period: Period, anchor: date | None, tz_name: str) -> Stats:
    tz = _zone(tz_name)
    today = datetime.now(tz).date()
    start, end = _period_range(period, anchor or today)

    daily = _daily_totals(db, user, start, end, tz)
    buckets = _month_buckets(start, end, daily) if period == "month" else _year_buckets(start, daily)
    achieved, total = _goal_weeks(db, user, start, end, today, tz, user.weekly_goal)

    return Stats(
        period=period,
        start=start,
        end=end,
        buckets=buckets,
        total_distance_m=sum(bucket.distance_m for bucket in buckets),
        total_count=sum(bucket.count for bucket in buckets),
        total_elapsed_s=sum(bucket.elapsed_s for bucket in buckets),
        goal_weeks_achieved=achieved,
        goal_weeks_total=total,
        weekly_goal=user.weekly_goal,
    )


def _zone(tz_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise AppError(status.HTTP_422_UNPROCESSABLE_CONTENT, "VALIDATION", "tz 값이 올바르지 않아요") from error


def _period_range(period: Period, anchor: date) -> tuple[date, date]:
    """기간의 [시작일, 끝 다음 날). anchor가 속한 달 또는 해."""
    if period == "month":
        start = anchor.replace(day=1)
        end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        return start, end
    return date(anchor.year, 1, 1), date(anchor.year + 1, 1, 1)


def _local_midnight(day: date, tz: ZoneInfo) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=tz)


def _daily_totals(db: Session, user: User, start: date, end: date, tz: ZoneInfo) -> dict[date, tuple[float, int, int]]:
    """날짜(사용자 시간대) → (거리 합, 인정 횟수, 시간 합). 범위 조건은 인덱스(user_id, started_at)를 탄다."""
    local_day = cast(func.timezone(tz.key, Run.started_at), Date)
    rows = db.execute(
        select(
            local_day.label("day"),
            func.coalesce(func.sum(Run.distance_m), 0.0),
            func.count().filter(Run.counted.is_(True)),
            func.coalesce(func.sum(Run.elapsed_s), 0),
        )
        .where(
            Run.user_id == user.id,
            Run.started_at >= _local_midnight(start, tz),
            Run.started_at < _local_midnight(end, tz),
        )
        .group_by(local_day)
    ).all()
    return {day: (float(distance), int(count), int(elapsed)) for day, distance, count, elapsed in rows}


def _month_buckets(start: date, end: date, daily: dict[date, tuple[float, int, int]]) -> list[Bucket]:
    """날짜별 묶음. 기록이 없는 날도 0으로 채워 차트의 칸이 비지 않게 한다."""
    buckets = []
    day = start
    while day < end:
        distance, count, elapsed = daily.get(day, (0.0, 0, 0))
        buckets.append(Bucket(label=str(day.day), start=day, distance_m=distance, count=count, elapsed_s=elapsed))
        day += timedelta(days=1)
    return buckets


def _year_buckets(start: date, daily: dict[date, tuple[float, int, int]]) -> list[Bucket]:
    """월별 묶음(1~12월)."""
    totals = {month: [0.0, 0, 0] for month in range(1, 13)}
    for day, (distance, count, elapsed) in daily.items():
        totals[day.month][0] += distance
        totals[day.month][1] += count
        totals[day.month][2] += elapsed
    return [
        Bucket(
            label=f"{month}월",
            start=date(start.year, month, 1),
            distance_m=totals[month][0],
            count=int(totals[month][1]),
            elapsed_s=int(totals[month][2]),
        )
        for month in range(1, 13)
    ]


def _goal_weeks(
    db: Session, user: User, start: date, end: date, today: date, tz: ZoneInfo, weekly_goal: int
) -> tuple[int, int]:
    """기간과 겹치는 주(월요일 시작) 가운데 인정 횟수가 주 목표 이상인 주의 수와, 따져 본 주의 수.

    아직 시작하지 않은 주는 세지 않는다. 기간 밖으로 걸친 주는 그 주 전체(월~일)의 횟수로 본다.
    """
    first_monday = start - timedelta(days=start.weekday())
    last_day = min(end - timedelta(days=1), today)
    if last_day < first_monday:
        return 0, 0
    last_monday = last_day - timedelta(days=last_day.weekday())
    week_count = (last_monday - first_monday).days // 7 + 1

    local_day = cast(func.timezone(tz.key, Run.started_at), Date)
    days = db.scalars(
        select(local_day).where(
            Run.user_id == user.id,
            Run.counted.is_(True),
            Run.started_at >= _local_midnight(first_monday, tz),
            Run.started_at < _local_midnight(last_monday + timedelta(days=7), tz),
        )
    ).all()

    per_week: dict[date, int] = {}
    for day in days:
        monday = day - timedelta(days=day.weekday())
        per_week[monday] = per_week.get(monday, 0) + 1
    achieved = sum(1 for count in per_week.values() if count >= weekly_goal)
    return achieved, week_count
