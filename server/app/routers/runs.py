"""러닝 올리기 · 목록 · 상세."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.deps import CurrentUser, DbSession
from app.schemas.run import RunDetail, RunIn, RunListOut, RunSummary
from app.services import run_service
from app.services.run_service import DEFAULT_LIMIT, MAX_LIMIT

router = APIRouter(prefix="/runs", tags=["runs"])


@router.put("/{run_id}", response_model=RunSummary)
def put_run(run_id: uuid.UUID, body: RunIn, response: Response, user: CurrentUser, db: DbSession) -> RunSummary:
    run, created = run_service.upsert_run(db, user, run_id, body)
    # 새로 저장했으면 201, 이미 있던 내 기록을 덮어썼으면 200
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return RunSummary.model_validate(run)


@router.get("", response_model=RunListOut)
def list_runs(
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: Annotated[str | None, Query(max_length=200)] = None,
) -> RunListOut:
    runs, next_cursor = run_service.list_runs(db, user, limit, cursor)
    return RunListOut(items=[RunSummary.model_validate(run) for run in runs], next_cursor=next_cursor)


@router.get("/{run_id}", response_model=RunDetail)
def get_run(run_id: uuid.UUID, user: CurrentUser, db: DbSession) -> RunDetail:
    return RunDetail.model_validate(run_service.get_run(db, user, run_id))
