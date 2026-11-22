import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, SmallInteger, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

WEEKLY_GOAL_MIN = 2
WEEKLY_GOAL_MAX = 5
WEEKLY_GOAL_DEFAULT = 3


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint(f"weekly_goal BETWEEN {WEEKLY_GOAL_MIN} AND {WEEKLY_GOAL_MAX}", name="ck_users_weekly_goal"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # 항상 소문자로 저장한다(서비스에서 정규화). 그래서 UNIQUE가 대소문자만 다른 중복도 막는다.
    email: Mapped[str] = mapped_column(String(254))
    password_hash: Mapped[str] = mapped_column(String(255))
    weekly_goal: Mapped[int] = mapped_column(
        SmallInteger, default=WEEKLY_GOAL_DEFAULT, server_default=str(WEEKLY_GOAL_DEFAULT)
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
