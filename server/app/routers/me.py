"""내 정보 조회 · 주 목표 변경."""

from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.schemas.auth import MeUpdateIn, UserOut
from app.services import user_service

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserOut)
def read_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("", response_model=UserOut)
def update_me(body: MeUpdateIn, user: CurrentUser, db: DbSession) -> UserOut:
    return UserOut.model_validate(user_service.update_weekly_goal(db, user, body.weekly_goal))
