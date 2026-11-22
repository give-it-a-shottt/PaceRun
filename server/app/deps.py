"""라우터가 함께 쓰는 의존성."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import unauthorized
from app.models import User
from app.security import decode_access_token

# auto_error=False: 토큰이 없을 때 FastAPI 기본 응답 대신 우리 에러 형식(401 UNAUTHORIZED)으로 답하려고
_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise unauthorized()
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized("로그인이 만료됐어요. 다시 로그인해 주세요")
    user = db.get(User, user_id)
    if user is None:
        # 토큰은 맞지만 회원이 지워진 경우
        raise unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
