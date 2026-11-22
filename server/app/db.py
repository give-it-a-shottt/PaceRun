"""DB 연결. 요청 하나가 세션 하나를 쓰고, 요청이 끝나면 닫는다."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings


@lru_cache
def get_engine() -> Engine:
    # pool_pre_ping: 끊긴 연결을 쓰기 전에 알아채고 다시 맺는다
    # hide_parameters: 오류 로그에 SQL에 넣은 값(이메일 · 해시)이 찍히지 않게 한다
    return create_engine(get_settings().database_url, pool_pre_ping=True, hide_parameters=True)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI 의존성. 커밋은 서비스 함수가 직접 하고, 예외가 나면 여기서 되돌린다."""
    session = get_session_factory()()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
