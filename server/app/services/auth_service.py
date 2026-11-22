"""가입 · 로그인 · 토큰 갱신 · 로그아웃. 요청 · 응답 · 쿠키를 다루지 않는다 — 그건 라우터가 맡는다."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import AppError
from app.models import RefreshToken, User
from app.security import (
    burn_password_check,
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)

# 방금 교체된 토큰이 이 시간 안에 다시 오면 "새어 나간 토큰"이 아니라 "같은 사용자의 동시 요청"으로 본다.
# (브라우저 탭 두 개가 같은 쿠키로 동시에 갱신하는 경우. 이때는 401만 주고 다른 토큰은 건드리지 않는다.)
ROTATION_GRACE = timedelta(seconds=10)
# 교체돼 못 쓰게 된 토큰 줄은 재사용 감지를 위해 이 기간만 남겨 두고 지운다
REVOKED_TOKEN_RETENTION = timedelta(days=1)


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
    if user is None:
        # 가입하지 않은 이메일도 해시 검증만큼 시간을 쓰게 해, 응답 시간으로 가입 여부를 알 수 없게 한다
        burn_password_check(password)
        password_ok = False
    else:
        password_ok = verify_password(password, user.password_hash)

    if user is None or not password_ok:
        # "이메일이 없다"와 "비밀번호가 틀렸다"를 구분해 알려 주지 않는다
        raise AppError(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않아요")

    tokens = _issue_tokens(db, user)
    db.commit()
    return user, tokens


def refresh(db: Session, refresh_token: str | None) -> TokenPair:
    """리프레시 토큰을 새것으로 바꾼다(한 번 쓴 토큰은 다시 못 쓴다)."""
    if not refresh_token:
        raise _invalid_refresh()

    now = datetime.now(UTC)
    # FOR UPDATE: 같은 토큰으로 동시에 두 번 갱신해도 한 요청만 성공하게 줄을 잠근다.
    # 늦게 온 요청은 앞 요청이 끝난 뒤에 "이미 교체된 줄"을 읽게 된다.
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)).with_for_update()
    )
    if stored is None:
        # 모르는 토큰이거나 로그아웃으로 지워진 토큰
        raise _invalid_refresh()

    if stored.revoked_at is not None:
        if now - stored.revoked_at > ROTATION_GRACE:
            # 한참 전에 교체된 토큰이 다시 왔다 = 토큰이 새어 나갔을 수 있다.
            # 그 회원의 토큰을 모두 끊어 다시 로그인하게 한다.
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
    return tokens


def logout(db: Session, refresh_token: str | None) -> None:
    """토큰을 지운다. 없는 토큰이어도 조용히 끝낸다(로그아웃은 여러 번 해도 결과가 같다).

    못 쓰게 표시만 하지 않고 지우는 이유: 로그아웃한 토큰이 나중에 다시 와도(오래된 탭 등)
    "새어 나간 토큰"으로 오해해 다른 기기까지 로그아웃시키지 않으려고.
    """
    if not refresh_token:
        return
    db.execute(delete(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
    db.commit()


def update_weekly_goal(db: Session, user: User, weekly_goal: int) -> User:
    user.weekly_goal = weekly_goal
    db.commit()
    return user


def _issue_tokens(db: Session, user: User) -> TokenPair:
    settings = get_settings()
    now = datetime.now(UTC)
    _delete_stale_tokens(db, user.id, now)

    access_token, expires_in = create_access_token(user.id, now)
    refresh_token, token_hash = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=now + timedelta(days=settings.refresh_token_days),
        )
    )
    db.flush()
    return TokenPair(access_token=access_token, refresh_token=refresh_token, expires_in=expires_in)


def _delete_stale_tokens(db: Session, user_id: uuid.UUID, now: datetime) -> None:
    """이 회원의 만료된 토큰과 오래전에 교체된 토큰 줄을 지운다. 토큰을 새로 줄 때마다 불러 줄이 쌓이지 않게 한다."""
    db.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == user_id,
            or_(RefreshToken.expires_at <= now, RefreshToken.revoked_at <= now - REVOKED_TOKEN_RETENTION),
        )
    )


def _revoke_all(db: Session, user_id: uuid.UUID, now: datetime) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
