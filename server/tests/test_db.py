"""get_db(요청마다 DB 세션을 주고 정리하는 곳)의 동작. 다른 테스트는 get_db를 바꿔 끼우므로 여기서 따로 본다."""

from unittest.mock import MagicMock

import pytest

from app import db as db_module


@pytest.fixture
def session(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    fake = MagicMock()
    monkeypatch.setattr(db_module, "get_session_factory", lambda: lambda: fake)
    return fake


def test_요청이_잘_끝나면_세션을_닫기만_한다(session: MagicMock):
    generator = db_module.get_db()
    assert next(generator) is session

    with pytest.raises(StopIteration):
        next(generator)

    session.rollback.assert_not_called()
    session.close.assert_called_once()


def test_요청_처리_중_예외가_나면_되돌리고_닫은_뒤_예외를_그대로_올린다(session: MagicMock):
    generator = db_module.get_db()
    next(generator)

    with pytest.raises(RuntimeError, match="boom"):
        generator.throw(RuntimeError("boom"))

    session.rollback.assert_called_once()
    session.close.assert_called_once()
