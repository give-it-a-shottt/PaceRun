"""가입 · 로그인 · 토큰 갱신 · 로그아웃. HTTP(요청 · 응답 · 쿠키)를 모른다 — 라우터가 맡는다."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import AppError
from app.models import RefreshToken, User
from app.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _email_taken() -> AppError:
    return AppError(status.HTTP_409_CONFLICT, "EMAIL_TAKEN", "이미 가입된 이메일이에요")


def _invalid_refresh() -> AppError:
    return AppError(status.HTTP_401_UNAUTHORIZED, "INVALID_REFRESH", "다시 로그인해 주세요")


def signup(db: Session, email: str, password: str) -> tuple[User, TokenPair]:
    email = normalize_email(email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise _email_taken()

    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError as error:
        # 위에서 확인한 직후 같은 이메일로 다른 요청이 먼저 가입한 경우. DB의 UNIQUE가 마지막으로 막아 준다.
        db.rollback()
        raise _email_taken() from error

    tokens = _issue_tokens(db, user)
    db.commit()
    return user, tokens


def login(db: Session, email: str, password: str) -> tuple[User, TokenPair]:
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    # 이메일이 없을 때도 해시 검증을 돌려, 응답 시간으로 가입 여부를 알 수 없게 한다
    if not verify_password(password, user.password_hash if user else None) or user is None:
        # "이메일이 없다"와 "비밀번호가 틀렸다"를 구분해 알려 주지 않는다
        raise AppError(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않아요")

    tokens = _issue_tokens(db, user)
    db.commit()
    return user, tokens


def refresh(db: Session, refresh_token: str | None) -> tuple[User, TokenPair]:
    """리프레시 토큰을 새것으로 바꾼다(한 번 쓴 토큰은 다시 못 쓴다)."""
    if not refresh_token:
        raise _invalid_refresh()

    now = datetime.now(UTC)
    # FOR UPDATE: 같은 토큰으로 동시에 두 번 갱신해도 한 요청만 성공하게 줄을 잠근다
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)).with_for_update()
    )
    if stored is None:
        raise _invalid_refresh()

    if stored.revoked_at is not None:
        # 이미 쓴 토큰이 다시 왔다 = 토큰이 새어 나갔을 수 있다. 그 회원의 토큰을 모두 끊어 다시 로그인하게 한다.
        _revoke_all(db, stored.user_id, now)
        db.commit()
        raise _invalid_refresh()

    if stored.expires_at <= now:
        raise _invalid_refresh()

    user = db.get(User, stored.user_id)
    if user is None:
        raise _invalid_refresh()

    stored.revoked_at = now
    tokens = _issue_tokens(db, user)
    db.commit()
    return user, tokens


def logout(db: Session, refresh_token: str | None) -> None:
    """토큰을 못 쓰게 한다. 없는 토큰이어도 조용히 끝낸다(로그아웃은 여러 번 해도 같다)."""
    if not refresh_token:
        return
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(refresh_token), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    db.commit()


def update_weekly_goal(db: Session, user: User, weekly_goal: int) -> User:
    user.weekly_goal = weekly_goal
    db.commit()
    return user


def _issue_tokens(db: Session, user: User) -> TokenPair:
    settings = get_settings()
    access_token, expires_in = create_access_token(user.id)
    refresh_token, token_hash = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    db.flush()
    return TokenPair(access_token=access_token, refresh_token=refresh_token, expires_in=expires_in)


def _revoke_all(db: Session, user_id: uuid.UUID, now: datetime) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
