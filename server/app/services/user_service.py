"""회원 정보 수정."""

from sqlalchemy.orm import Session

from app.models import User


def update_weekly_goal(db: Session, user: User, weekly_goal: int) -> User:
    user.weekly_goal = weekly_goal
    db.commit()
    return user
