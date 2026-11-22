import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# SHA-256을 16진수로 적은 길이
TOKEN_HASH_LENGTH = 64


class RefreshToken(Base):
    """리프레시 토큰의 해시. 토큰 원문은 저장하지 않는다(DB가 새도 토큰을 쓸 수 없게)."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
        Index("ix_refresh_tokens_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(TOKEN_HASH_LENGTH))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # 새 토큰으로 교체된 시각. null이면 아직 쓸 수 있다. (로그아웃은 표시하지 않고 줄을 지운다)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
