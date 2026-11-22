"""가입 · 로그인 · 토큰 갱신 · 로그아웃. 요청을 받아 서비스에 넘기고, 응답 모양과 쿠키만 맡는다."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Header, Response, status

from app.config import get_settings
from app.deps import DbSession
from app.models import User
from app.schemas.auth import AuthOut, LoginIn, RefreshIn, SignupIn, TokenOut, UserOut
from app.services import auth_service
from app.services.auth_service import TokenPair

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "pr_refresh"
# 쿠키는 토큰을 다루는 주소로 갈 때만 붙는다(다른 API 요청에는 실리지 않는다)
REFRESH_COOKIE_PATH = "/api/v1/auth"
COOKIE_MODE = "cookie"

# 웹은 이 헤더를 "cookie"로 보낸다. 그러면 리프레시 토큰을 응답 본문에 넣지 않고
# 자바스크립트가 읽을 수 없는 쿠키로만 준다. 앱은 헤더 없이 본문으로 받는다(D-006).
RefreshMode = Annotated[str | None, Header(alias="X-Refresh-Mode")]
RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def _deliver(response: Response, tokens: TokenPair, mode: str | None) -> TokenOut:
    if mode != COOKIE_MODE:
        return TokenOut(
            access_token=tokens.access_token, refresh_token=tokens.refresh_token, expires_in=tokens.expires_in
        )

    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        # 다른 사이트가 보낸 POST에는 쿠키가 실리지 않는다(CSRF 방어)
        samesite="lax",
    )
    return TokenOut(access_token=tokens.access_token, refresh_token=None, expires_in=tokens.expires_in)


def _auth_out(response: Response, user: User, tokens: TokenPair, mode: str | None) -> AuthOut:
    delivered = _deliver(response, tokens, mode)
    return AuthOut(**delivered.model_dump(), user=UserOut.model_validate(user))


@router.post("/signup", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupIn, response: Response, db: DbSession, mode: RefreshMode = None) -> AuthOut:
    user, tokens = auth_service.signup(db, body.email, body.password)
    return _auth_out(response, user, tokens, mode)


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, response: Response, db: DbSession, mode: RefreshMode = None) -> AuthOut:
    user, tokens = auth_service.login(db, body.email, body.password)
    return _auth_out(response, user, tokens, mode)


@router.post("/refresh", response_model=TokenOut)
def refresh(
    response: Response,
    db: DbSession,
    body: RefreshIn | None = None,
    cookie_token: RefreshCookie = None,
    mode: RefreshMode = None,
) -> TokenOut:
    # 쿠키 방식(웹)은 쿠키의 토큰만 쓴다. 본문 토큰을 함께 받으면 어느 쪽이 맞는지 모호해진다.
    token = cookie_token if mode == COOKIE_MODE else (body.refresh_token if body else None)
    _, tokens = auth_service.refresh(db, token)
    return _deliver(response, tokens, mode)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbSession,
    body: RefreshIn | None = None,
    cookie_token: RefreshCookie = None,
) -> None:
    auth_service.logout(db, cookie_token or (body.refresh_token if body else None))
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
