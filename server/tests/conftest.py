"""테스트 준비.

- 테스트 전용 DB(TEST_DATABASE_URL)를 쓴다. 없으면 만들고, 시작할 때 비운 뒤 Alembic으로 테이블을 만든다
  (마이그레이션 파일도 함께 검증된다).
- 테스트 하나는 트랜잭션 하나 안에서 돌고 끝나면 되돌린다. 그래서 테스트끼리 데이터가 섞이지 않는다.
"""

from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Connection, Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.main import app


def _test_url() -> str:
    settings = get_settings()
    url = settings.test_database_url
    if not url:
        raise RuntimeError("TEST_DATABASE_URL이 없어요. server/.env.example을 보고 채워 주세요.")
    # 테스트는 DB를 통째로 비운다. 개발 DB를 지우는 사고를 막는다.
    if url == settings.database_url or not (make_url(url).database or "").endswith("_test"):
        raise RuntimeError("TEST_DATABASE_URL은 개발 DB와 다르고 이름이 _test로 끝나야 해요.")
    return url


def _ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        exists = connection.scalar(text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database})
        if not exists:
            # DB 이름은 바인딩할 수 없다. 위에서 _test로 끝나는 우리 설정값만 온다.
            connection.execute(text(f'CREATE DATABASE "{target.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    url = _test_url()
    _ensure_database(url)
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(config, "head")

    yield engine
    engine.dispose()


@pytest.fixture
def connection(engine: Engine) -> Iterator[Connection]:
    with engine.connect() as connection:
        transaction = connection.begin()
        yield connection
        transaction.rollback()


@pytest.fixture
def db(connection: Connection) -> Iterator[Session]:
    # 서비스가 commit()을 불러도 바깥 트랜잭션은 끝나지 않게, 세션은 저장점(savepoint) 위에서 돈다
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    yield session
    session.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


EMAIL = "runner@example.com"
PASSWORD = "correct-horse-battery"


@pytest.fixture
def signed_up(client: TestClient) -> dict:
    """가입한 회원 한 명. 응답 본문(access_token, refresh_token, user)을 돌려준다."""
    response = client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 201
    return response.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
