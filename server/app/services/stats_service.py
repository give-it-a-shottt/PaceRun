"""웹 대시보드용 통계: 기간(월 · 년) 안의 날짜별 / 월별 합계와 주 목표 달성 주 수.

"하루"와 "한 주(월요일 0시 시작)"는 사용자의 시간대로 나눈다. 서버 시각(UTC)으로 나누면
한국에서 아침 7시에 뛴 기록이 전날로 잡힌다.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import cached_property, lru_cache
from zoneinfo import ZoneInfo, available_timezones

from fastapi import status
from sqlalchemy import ColumnElement, Date, cast, func, select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Run, User
from app.schemas.stats import Period

DEFAULT_TZ = "Asia/Seoul"
# 통계를 볼 수 있는 날짜 범위. 이 밖의 날짜(예: 9999년)는 날짜 계산이 넘쳐 오류가 난다.
MIN_ANCHOR = date(2000, 1, 1)
MAX_ANCHOR = date(2100, 12, 31)
DAYS_PER_WEEK = 7
MONTHS_PER_YEAR = 12


@dataclass
class Totals:
    """거리 · 인정 횟수 · 시간의 합. 하루, 한 달, 기간 전체에 같은 모양을 쓴다."""

    distance_m: float = 0.0
    count: int = 0
    elapsed_s: int = 0

    def add(self, other: "Totals") -> None:
        self.distance_m += other.distance_m
        self.count += other.count
        self.elapsed_s += other.elapsed_s


@dataclass(frozen=True)
class Bucket:
    label: str
    start: date
    distance_m: float
    count: int
    elapsed_s: int


@dataclass(frozen=True)
class GoalWeeks:
    achieved: int
    total: int


@dataclass(frozen=True)
class Stats:
    period: Period
    start: date
    end: date
    buckets: list[Bucket]
    totals: Totals
    goal_weeks: GoalWeeks
    weekly_goal: int


@dataclass(frozen=True)
class _Scope:
    """통계 쿼리가 함께 쓰는 조건: 누구의 기록을, 어느 시간대의 날짜로 나눌지."""

    db: Session
    user: User
    tz: ZoneInfo

    @cached_property
    def local_day(self) -> ColumnElement[date]:
        """사용자 시간대 기준의 날짜. 예: 한국 11월 1일 07시(UTC 10월 31일 22시) → 11월 1일

        한 번만 만들어 같은 식을 돌려쓴다. 부를 때마다 새로 만들면 SELECT와 GROUP BY에 들어간 식이
        서로 다른 매개변수를 갖게 되어, Postgres가 "GROUP BY에 없는 칸"이라며 거절한다.
        """
        return cast(func.timezone(self.tz.key, Run.started_at), Date)

    def between(self, start: date, end: date) -> list[ColumnElement[bool]]:
        """내 기록 가운데 [start, end) 날짜에 시작한 것. 범위 조건이 인덱스(user_id, started_at)를 탄다."""
        return [
            Run.user_id == self.user.id,
            Run.started_at >= _local_midnight(start, self.tz),
            Run.started_at < _local_midnight(end, self.tz),
        ]


def get_stats(db: Session, user: User, period: Period, anchor: date | None, tz_name: str) -> Stats:
    tz = _zone(tz_name)
    today = datetime.now(tz).date()
    start, end = _period_range(period, _checked_anchor(anchor or today))
    scope = _Scope(db=db, user=user, tz=tz)

    daily = _daily_totals(scope, start, end)
    buckets = _month_buckets(start, end, daily) if period == "month" else _year_buckets(start, daily)
    totals = Totals()
    for day_total in daily.values():
        totals.add(day_total)

    return Stats(
        period=period,
        start=start,
        end=end,
        buckets=buckets,
        totals=totals,
        goal_weeks=_goal_weeks(scope, start, end, today),
        weekly_goal=user.weekly_goal,
    )


def _validation_error(message: str) -> AppError:
    return AppError(status.HTTP_422_UNPROCESSABLE_CONTENT, "VALIDATION", message)


@lru_cache
def _known_timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def _zone(tz_name: str) -> ZoneInfo:
    # 목록에 있는 이름만 받는다. ZoneInfo(이름)를 바로 부르면 "Asia" 같은 폴더 이름에서 다른 종류의 오류가 나고,
    # 파이썬은 받아도 Postgres가 모르는 이름이면 쿼리에서 500이 난다.
    if tz_name not in _known_timezones():
        raise _validation_error("tz 값이 올바르지 않아요")
    return ZoneInfo(tz_name)


def _checked_anchor(anchor: date) -> date:
    if not MIN_ANCHOR <= anchor <= MAX_ANCHOR:
        raise _validation_error(f"anchor는 {MIN_ANCHOR.year}년부터 {MAX_ANCHOR.year}년까지만 볼 수 있어요")
    return anchor


def _first_day_of_next_month(day: date) -> date:
    return date(day.year + 1, 1, 1) if day.month == MONTHS_PER_YEAR else date(day.year, day.month + 1, 1)


def _period_range(period: Period, anchor: date) -> tuple[date, date]:
    """기간의 [시작일, 끝 다음 날). anchor가 속한 달 또는 해."""
    if period == "month":
        start = anchor.replace(day=1)
        return start, _first_day_of_next_month(start)
    return date(anchor.year, 1, 1), date(anchor.year + 1, 1, 1)


def _local_midnight(day: date, tz: ZoneInfo) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=tz)


def _monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _daily_totals(scope: _Scope, start: date, end: date) -> dict[date, Totals]:
    """날짜(사용자 시간대) → 그날의 합. 기록이 없는 날은 들어 있지 않다."""
    rows = scope.db.execute(
        select(
            scope.local_day.label("day"),
            func.coalesce(func.sum(Run.distance_m), 0.0),
            func.count().filter(Run.counted.is_(True)),
            func.coalesce(func.sum(Run.elapsed_s), 0),
        )
        .where(*scope.between(start, end))
        .group_by(scope.local_day)
    ).all()
    return {
        day: Totals(distance_m=float(distance), count=int(count), elapsed_s=int(elapsed))
        for day, distance, count, elapsed in rows
    }


def _bucket(label: str, start: date, totals: Totals) -> Bucket:
    return Bucket(
        label=label, start=start, distance_m=totals.distance_m, count=totals.count, elapsed_s=totals.elapsed_s
    )


def _month_buckets(start: date, end: date, daily: dict[date, Totals]) -> list[Bucket]:
    """날짜별 묶음. 기록이 없는 날도 0으로 채워 차트의 칸이 비지 않게 한다."""
    days = (start + timedelta(days=offset) for offset in range((end - start).days))
    return [_bucket(str(day.day), day, daily.get(day, Totals())) for day in days]


def _year_buckets(start: date, daily: dict[date, Totals]) -> list[Bucket]:
    """월별 묶음(1~12월)."""
    monthly = {month: Totals() for month in range(1, MONTHS_PER_YEAR + 1)}
    for day, totals in daily.items():
        monthly[day.month].add(totals)
    return [_bucket(f"{month}월", date(start.year, month, 1), totals) for month, totals in monthly.items()]


def _goal_weeks(scope: _Scope, start: date, end: date, today: date) -> GoalWeeks:
    """기간과 겹치는 주(월요일 시작) 가운데 인정 횟수가 주 목표 이상인 주의 수와, 따져 본 주의 수.

    - 아직 시작하지 않은 주는 세지 않는다.
    - 기간 밖으로 걸친 주(예: 12월 29일 월요일 ~ 1월 4일)는 그 주 전체(월~일)의 횟수로 본다.
    - 목표는 지금의 주 목표로 따진다(목표를 바꾸면 지난 주들의 달성 여부도 바뀐다).
    """
    first_monday = _monday_of(start)
    last_day = min(end - timedelta(days=1), today)
    if last_day < first_monday:
        return GoalWeeks(achieved=0, total=0)
    last_monday = _monday_of(last_day)
    week_count = (last_monday - first_monday).days // DAYS_PER_WEEK + 1

    counted_days = scope.db.scalars(
        select(scope.local_day).where(
            *scope.between(first_monday, last_monday + timedelta(days=DAYS_PER_WEEK)),
            Run.counted.is_(True),
        )
    ).all()

    per_week: dict[date, int] = {}
    for day in counted_days:
        monday = _monday_of(day)
        per_week[monday] = per_week.get(monday, 0) + 1
    achieved = sum(1 for count in per_week.values() if count >= scope.user.weekly_goal)
    return GoalWeeks(achieved=achieved, total=week_count)
