"""러닝 올리기 · 목록 · 상세. 모든 조회에 "내 것만"(user_id) 조건이 붙는다."""

import base64
import binascii
import uuid
from datetime import datetime

from fastapi import status
from sqlalchemy import Boolean, func, literal_column, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, defer

from app.errors import AppError, unauthorized
from app.models import Run, User
from app.models.run import COUNTED_MIN_ELAPSED_S
from app.schemas.run import RunIn

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def upsert_run(db: Session, user: User, run_id: uuid.UUID, data: RunIn) -> tuple[Run, bool]:
    """러닝을 저장한다. (저장된 러닝, 새로 만들었는지)를 돌려준다.

    같은 번호를 여러 번 올려도 한 줄만 남는다(D-007). 번호는 폰이 정하므로,
    이미 있는 번호가 다른 회원의 것이면 덮어쓰지 않고 409를 준다.
    """
    values = {
        "id": run_id,
        "user_id": user.id,
        "mode": data.mode,
        "config": data.config,
        "plan_label": data.plan_label,
        "started_at": data.started_at,
        "ended_at": data.ended_at,
        "elapsed_s": data.elapsed_s,
        "distance_m": data.distance_m,
        "avg_pace_s_per_km": data.avg_pace_s_per_km,
        # 인정 여부는 클라이언트가 보낸 값을 믿지 않고 서버가 같은 규칙으로 정한다
        "counted": data.elapsed_s >= COUNTED_MIN_ELAPSED_S,
        "segments": [segment.model_dump() for segment in data.segments],
        "route": [list(point) for point in data.route],
    }
    statement = insert(Run).values(values)
    updates = {key: statement.excluded[key] for key in values if key not in ("id", "user_id")}
    updates["updated_at"] = func.now()

    # "있으면 고치고 없으면 넣기"를 문장 하나로 한다. 확인과 저장 사이에 다른 요청이 끼어들 틈이 없다.
    # WHERE: 이미 있는 줄이 내 것일 때만 고친다. 남의 줄이면 아무것도 돌려주지 않는다.
    statement = statement.on_conflict_do_update(
        index_elements=[Run.id],
        set_=updates,
        where=Run.user_id == user.id,
    ).returning(Run.id, literal_column("(runs.xmax = 0)", Boolean).label("inserted"))
    # xmax는 Postgres가 줄마다 적어 두는 숨은 칸이다. 0이면 방금 새로 넣은 줄, 아니면 고친 줄.

    try:
        row = db.execute(statement).first()
    except IntegrityError as error:
        # 로그인 확인 직후 회원이 지워진 경우(user_id 외래키 위반). 로그인이 풀린 것과 같다.
        db.rollback()
        raise unauthorized() from error
    if row is None:
        db.rollback()
        raise AppError(status.HTTP_409_CONFLICT, "RUN_ID_CONFLICT", "이 기록 번호는 이미 쓰이고 있어요")
    db.commit()

    # 응답은 요약뿐이라 큰 칸(경로 · 구간)은 다시 읽지 않는다
    run = db.get(Run, run_id, populate_existing=True, options=[defer(Run.route), defer(Run.segments)])
    if run is None:  # 방금 저장한 줄이라 일어나지 않지만, None을 그대로 흘려보내지 않는다
        raise AppError(status.HTTP_500_INTERNAL_SERVER_ERROR, "INTERNAL", "기록을 저장하지 못했어요")
    return run, bool(row.inserted)


def get_run(db: Session, user: User, run_id: uuid.UUID) -> Run:
    run = db.scalar(select(Run).where(Run.id == run_id, Run.user_id == user.id))
    if run is None:
        # 없는 번호와 남의 번호를 구분해 알려 주지 않는다(번호가 존재하는지 알 수 없게)
        raise AppError(status.HTTP_404_NOT_FOUND, "RUN_NOT_FOUND", "기록을 찾을 수 없어요")
    return run


def list_runs(db: Session, user: User, limit: int, cursor: str | None) -> tuple[list[Run], str | None]:
    """최신순 목록. (러닝들, 다음 쪽 커서)를 돌려준다.

    쪽 번호(OFFSET) 대신 "이 줄 다음부터"로 넘긴다. 뒤쪽으로 갈수록 느려지지 않고,
    보는 사이 새 기록이 올라와도 같은 줄이 두 번 나오지 않는다.
    """
    statement = (
        select(Run)
        .where(Run.user_id == user.id)
        # 목록에는 경로 · 구간이 필요 없다. 큰 칸을 읽지 않는다.
        .options(defer(Run.route), defer(Run.segments))
        .order_by(Run.started_at.desc(), Run.id.desc())
        .limit(limit + 1)
    )
    if cursor:
        started_at, run_id = _decode_cursor(cursor)
        statement = statement.where(tuple_(Run.started_at, Run.id) < (started_at, run_id))

    runs = list(db.scalars(statement))
    if len(runs) <= limit:
        return runs, None
    page = runs[:limit]
    last = page[-1]
    return page, _encode_cursor(last.started_at, last.id)


def _encode_cursor(started_at: datetime, run_id: uuid.UUID) -> str:
    raw = f"{started_at.isoformat()}|{run_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        started_at, run_id = raw.split("|", 1)
        return datetime.fromisoformat(started_at), uuid.UUID(run_id)
    except (ValueError, binascii.Error, UnicodeDecodeError) as error:
        raise AppError(status.HTTP_422_UNPROCESSABLE_CONTENT, "VALIDATION", "cursor 값이 올바르지 않아요") from error
