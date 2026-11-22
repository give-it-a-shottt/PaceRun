import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# 이 시간(초) 이상 뛰어야 주간 횟수 1회로 인정한다. 앱의 COUNTED_MIN_ELAPSED_MS(10분)와 같은 규칙이다.
# 앱과 서버는 코드를 나누지 않아(D-003) 규칙이 두 곳에 있다. 바꿀 때는 둘 다 바꾼다.
COUNTED_MIN_ELAPSED_S = 10 * 60


class Run(Base):
    """러닝 1건. id는 폰이 만든 UUID를 그대로 쓴다(D-007) — 같은 기록을 여러 번 올려도 한 줄이다."""

    __tablename__ = "runs"
    __table_args__ = (
        CheckConstraint("mode IN ('free', 'interval', 'cadence', 'pacemaker')", name="ck_runs_mode"),
        CheckConstraint("elapsed_s >= 0", name="ck_runs_elapsed_s"),
        CheckConstraint("distance_m >= 0", name="ck_runs_distance_m"),
        CheckConstraint("ended_at >= started_at", name="ck_runs_ended_after_started"),
        # 목록(최신순)과 기간 통계가 모두 "내 러닝을 시작 시각 순으로" 읽는다
        Index("ix_runs_user_started", "user_id", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    mode: Mapped[str] = mapped_column(String(16))
    config: Mapped[dict[str, Any]] = mapped_column(JSONB)
    plan_label: Mapped[str | None] = mapped_column(String(50))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    elapsed_s: Mapped[int] = mapped_column(Integer)
    distance_m: Mapped[float] = mapped_column(Float)
    avg_pace_s_per_km: Mapped[float | None] = mapped_column(Float)
    # 10분 이상 뛰어 주간 횟수 1회로 인정됐는지. 서버가 elapsed_s로 정한다.
    counted: Mapped[bool] = mapped_column(Boolean)
    # 경로와 구간은 항상 러닝 하나 단위로 통째로 읽으므로 한 칸에 둔다(D-007)
    segments: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    route: Mapped[list[list[float]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
