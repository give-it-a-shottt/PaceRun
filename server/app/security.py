"""비밀번호 해시와 토큰. HTTP · DB를 모르는 순수 함수만 둔다."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import get_settings

_password_hash = PasswordHash.recommended()  # argon2id

# burn_password_check가 쓰는 가짜 해시. 서버가 뜰 때 한 번 만든다.
_DUMMY_HASH = _password_hash.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def burn_password_check(password: str) -> None:
    """가입하지 않은 이메일로 로그인했을 때, 실제 검증과 같은 시간을 쓰기만 한다(결과는 버린다)."""
    _password_hash.verify(password, _DUMMY_HASH)


def create_access_token(user_id: uuid.UUID, now: datetime | None = None) -> tuple[str, int]:
    """(토큰, 유효 시간(초))를 돌려준다."""
    settings = get_settings()
    issued_at = now or datetime.now(UTC)
    expires_in = settings.access_token_minutes * 60
    payload = {
        "sub": str(user_id),
        "iat": issued_at,
        "exp": issued_at + timedelta(seconds=expires_in),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), expires_in


def decode_access_token(token: str) -> uuid.UUID | None:
    """서명 · 만료 · 종류를 확인하고 회원 번호를 돌려준다. 하나라도 틀리면 None."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            # 알고리즘을 고정한다(토큰이 스스로 "서명 없음"이라고 주장하는 공격을 막는다)
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
        if payload.get("type") != "access":
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError):
        return None


def new_refresh_token() -> tuple[str, str]:
    """(클라이언트에 줄 토큰, DB에 저장할 해시)를 돌려준다."""
    token = secrets.token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    # 리프레시 토큰은 길고 무작위라 느린 해시(argon2)가 필요 없다. DB에서 해시로 바로 찾을 수 있게 SHA-256을 쓴다.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
