import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import WEEKLY_GOAL_MAX, WEEKLY_GOAL_MIN

# argon2는 긴 입력도 받지만, 너무 긴 비밀번호로 서버를 느리게 만드는 요청을 막으려고 상한을 둔다
PASSWORD_MIN = 8
PASSWORD_MAX = 72


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)


class LoginIn(BaseModel):
    email: EmailStr
    # 로그인은 길이 규칙을 알려 주지 않는다(틀리면 그냥 401)
    password: str = Field(min_length=1, max_length=PASSWORD_MAX)


class RefreshIn(BaseModel):
    """앱은 본문으로, 웹은 쿠키로 리프레시 토큰을 보낸다. 그래서 본문 값은 없어도 된다."""

    refresh_token: str | None = Field(default=None, max_length=512)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    weekly_goal: int


class TokenOut(BaseModel):
    access_token: str
    # 쿠키 방식(웹)에서는 null. 그때 리프레시 토큰은 httpOnly 쿠키로만 간다.
    refresh_token: str | None
    token_type: str = "bearer"  # noqa: S105 — 비밀번호가 아니라 토큰 종류 이름이다
    expires_in: int


class AuthOut(TokenOut):
    user: UserOut


class MeUpdateIn(BaseModel):
    weekly_goal: int = Field(ge=WEEKLY_GOAL_MIN, le=WEEKLY_GOAL_MAX)
