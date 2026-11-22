import json
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Run
from tests.conftest import PASSWORD, auth_header

RUNS = "/api/v1/runs"
STARTED = datetime(2026, 11, 20, 7, 0, tzinfo=UTC)


def error_code(response) -> str:
    return response.json()["detail"]["code"]


def run_body(**overrides) -> dict:
    body = {
        "mode": "interval",
        "config": {"run_sec": 60, "walk_sec": 90, "repeats": 8},
        "plan_label": "인터벌 입문",
        "started_at": STARTED.isoformat(),
        "ended_at": (STARTED + timedelta(minutes=20)).isoformat(),
        "elapsed_s": 1200,
        "distance_m": 3200.5,
        "avg_pace_s_per_km": 375.0,
        "segments": [
            {"idx": 0, "kind": "run", "started_elapsed_s": 0, "duration_s": 60, "distance_m": 180.0},
            {"idx": 1, "kind": "walk", "started_elapsed_s": 60, "duration_s": 90, "distance_m": 130.0},
        ],
        "route": [[37.5, 127.0, 0], [37.5001, 127.0001, 1], [37.5002, 127.0002, 2]],
    }
    body.update(overrides)
    return body


@pytest.fixture
def headers(signed_up: dict) -> dict[str, str]:
    return auth_header(signed_up["access_token"])


@pytest.fixture
def other_headers(client: TestClient) -> dict[str, str]:
    """다른 회원 한 명"""
    response = client.post("/api/v1/auth/signup", json={"email": "other@example.com", "password": PASSWORD})
    return auth_header(response.json()["access_token"])


class TestPutRun:
    def test_새_러닝을_올리면_201과_요약을_돌려준다(self, client: TestClient, headers: dict):
        run_id = str(uuid.uuid4())

        response = client.put(f"{RUNS}/{run_id}", json=run_body(), headers=headers)

        assert response.status_code == 201
        body = response.json()
        assert body["id"] == run_id
        assert body["mode"] == "interval"
        assert body["config"] == {"run_sec": 60, "walk_sec": 90, "repeats": 8}
        assert body["elapsed_s"] == 1200
        assert body["counted"] is True
        # 요약에는 경로 · 구간을 싣지 않는다
        assert "route" not in body and "segments" not in body

    def test_같은_번호로_다시_올리면_200이고_한_줄만_남는다(self, client: TestClient, db: Session, headers: dict):
        run_id = str(uuid.uuid4())
        client.put(f"{RUNS}/{run_id}", json=run_body(), headers=headers)

        again = client.put(f"{RUNS}/{run_id}", json=run_body(distance_m=3300.0), headers=headers)

        assert again.status_code == 200
        assert again.json()["distance_m"] == 3300.0
        assert db.scalar(select(func.count()).select_from(Run)) == 1

    def test_다른_회원의_번호로는_올릴_수_없고_원래_기록도_바뀌지_않는다(
        self, client: TestClient, db: Session, headers: dict, other_headers: dict
    ):
        run_id = str(uuid.uuid4())
        client.put(f"{RUNS}/{run_id}", json=run_body(), headers=headers)

        response = client.put(f"{RUNS}/{run_id}", json=run_body(distance_m=1.0), headers=other_headers)

        assert response.status_code == 409
        assert error_code(response) == "RUN_ID_CONFLICT"
        stored = db.scalar(select(Run).where(Run.id == uuid.UUID(run_id)))
        assert stored is not None and stored.distance_m == 3200.5

    def test_인정_여부는_서버가_경과_시간으로_정한다(self, client: TestClient, headers: dict):
        short = client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(elapsed_s=599), headers=headers)
        exact = client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(elapsed_s=600), headers=headers)

        assert short.json()["counted"] is False
        assert exact.json()["counted"] is True

    def test_클라이언트가_counted를_보내면_422(self, client: TestClient, headers: dict):
        response = client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(counted=True), headers=headers)
        assert response.status_code == 422

    def test_로그인하지_않으면_401(self, client: TestClient):
        assert client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body()).status_code == 401

    @pytest.mark.parametrize(
        "overrides",
        [
            {"mode": "swim"},
            {"config": {"run_sec": 60}},  # 인터벌인데 목표값이 모자람
            {"config": {"run_sec": 60, "walk_sec": 90, "repeats": 8, "extra": 1}},  # 모르는 칸
            {"mode": "cadence", "config": {"spm": 500, "duration_sec": 1200}},
            {"started_at": "2026-11-20T07:00:00"},  # 시간대 없음
            {"ended_at": (STARTED - timedelta(minutes=1)).isoformat()},  # 끝이 시작보다 빠름
            {"elapsed_s": -1},
            {"distance_m": -5},
            {"route": [[91.0, 127.0, 0]]},  # 위도 범위 밖
            {"route": [[37.5, 127.0]]},  # 칸이 모자람
            {"segments": [{"idx": 0, "kind": "sprint", "started_elapsed_s": 0, "duration_s": 1, "distance_m": 1}]},
            {"plan_label": "가" * 51},
        ],
    )
    def test_잘못된_값은_422(self, client: TestClient, headers: dict, overrides: dict):
        response = client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(**overrides), headers=headers)

        assert response.status_code == 422
        assert error_code(response) == "VALIDATION"

    def test_경로가_너무_길면_422(self, client: TestClient, headers: dict):
        route = [[37.5, 127.0, i] for i in range(20_001)]
        response = client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(route=route), headers=headers)
        assert response.status_code == 422

    def test_번호가_UUID가_아니면_422(self, client: TestClient, headers: dict):
        assert client.put(f"{RUNS}/not-a-uuid", json=run_body(), headers=headers).status_code == 422

    def test_모드마다_목표값_모양을_확인한다(self, client: TestClient, headers: dict):
        cases = [
            ("free", {"target_duration_sec": None}),
            ("free", {"target_duration_sec": 600}),
            ("cadence", {"spm": 170, "duration_sec": 1200}),
            ("pacemaker", {"target_pace_s_per_km": 390, "distance_m": 3000}),
        ]
        for mode, config in cases:
            response = client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(mode=mode, config=config), headers=headers)
            assert response.status_code == 201, (mode, response.text)
            assert response.json()["config"] == config


class TestGetRun:
    def test_상세에는_경로와_구간이_들어_있다(self, client: TestClient, headers: dict):
        run_id = str(uuid.uuid4())
        client.put(f"{RUNS}/{run_id}", json=run_body(), headers=headers)

        response = client.get(f"{RUNS}/{run_id}", headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert body["route"] == [[37.5, 127.0, 0], [37.5001, 127.0001, 1], [37.5002, 127.0002, 2]]
        assert [segment["kind"] for segment in body["segments"]] == ["run", "walk"]

    def test_없는_번호와_남의_번호는_똑같이_404(self, client: TestClient, headers: dict, other_headers: dict):
        run_id = str(uuid.uuid4())
        client.put(f"{RUNS}/{run_id}", json=run_body(), headers=headers)

        missing = client.get(f"{RUNS}/{uuid.uuid4()}", headers=headers)
        someone_elses = client.get(f"{RUNS}/{run_id}", headers=other_headers)

        assert missing.status_code == someone_elses.status_code == 404
        assert missing.json() == someone_elses.json()
        assert error_code(missing) == "RUN_NOT_FOUND"

    def test_로그인하지_않으면_401(self, client: TestClient):
        assert client.get(f"{RUNS}/{uuid.uuid4()}").status_code == 401


class TestListRuns:
    def _upload(self, client: TestClient, headers: dict, count: int) -> list[str]:
        """하루 간격으로 count개를 올리고, 최신순 번호 목록을 돌려준다."""
        ids = []
        for day in range(count):
            run_id = str(uuid.uuid4())
            started = STARTED + timedelta(days=day)
            body = run_body(started_at=started.isoformat(), ended_at=(started + timedelta(minutes=20)).isoformat())
            assert client.put(f"{RUNS}/{run_id}", json=body, headers=headers).status_code == 201
            ids.append(run_id)
        return list(reversed(ids))

    def test_최신순으로_내_러닝만_돌려준다(self, client: TestClient, headers: dict, other_headers: dict):
        mine = self._upload(client, headers, 3)
        client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(), headers=other_headers)

        response = client.get(RUNS, headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert [item["id"] for item in body["items"]] == mine
        assert body["next_cursor"] is None
        assert "route" not in body["items"][0]

    def test_커서로_다음_쪽을_이어_받고_겹치거나_빠지는_줄이_없다(self, client: TestClient, headers: dict):
        mine = self._upload(client, headers, 5)

        first = client.get(RUNS, params={"limit": 2}, headers=headers).json()
        second = client.get(RUNS, params={"limit": 2, "cursor": first["next_cursor"]}, headers=headers).json()
        third = client.get(RUNS, params={"limit": 2, "cursor": second["next_cursor"]}, headers=headers).json()

        seen = [item["id"] for page in (first, second, third) for item in page["items"]]
        assert seen == mine
        assert first["next_cursor"] and second["next_cursor"]
        assert third["next_cursor"] is None

    def test_시작_시각이_같은_러닝도_쪽이_넘어갈_때_빠지지_않는다(self, client: TestClient, headers: dict):
        ids = set()
        for _ in range(3):
            run_id = str(uuid.uuid4())
            client.put(f"{RUNS}/{run_id}", json=run_body(), headers=headers)
            ids.add(run_id)

        first = client.get(RUNS, params={"limit": 2}, headers=headers).json()
        second = client.get(RUNS, params={"limit": 2, "cursor": first["next_cursor"]}, headers=headers).json()

        assert {item["id"] for item in first["items"] + second["items"]} == ids

    def test_기록이_없으면_빈_목록(self, client: TestClient, headers: dict):
        assert client.get(RUNS, headers=headers).json() == {"items": [], "next_cursor": None}

    def test_limit과_cursor가_잘못되면_422(self, client: TestClient, headers: dict):
        assert client.get(RUNS, params={"limit": 0}, headers=headers).status_code == 422
        assert client.get(RUNS, params={"limit": 101}, headers=headers).status_code == 422
        bad_cursor = client.get(RUNS, params={"cursor": "not-a-cursor"}, headers=headers)
        assert bad_cursor.status_code == 422
        assert error_code(bad_cursor) == "VALIDATION"

    def test_로그인하지_않으면_401(self, client: TestClient):
        assert client.get(RUNS).status_code == 401


class TestCascade:
    def test_회원을_지우면_그_회원의_러닝도_지워진다(
        self, client: TestClient, db: Session, signed_up: dict, headers: dict
    ):
        from app.models import User

        client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(), headers=headers)
        db.delete(db.get(User, uuid.UUID(signed_up["user"]["id"])))
        db.commit()

        assert db.scalar(select(func.count()).select_from(Run)) == 0


class TestConsistency:
    def test_경과_시간이_끝_시각에서_시작_시각을_뺀_것보다_길면_422(self, client: TestClient, headers: dict):
        """1분 뛴 기록에 elapsed_s만 크게 보내 10분 인정을 받는 것을 막는다."""
        body = run_body(ended_at=(STARTED + timedelta(minutes=1)).isoformat(), elapsed_s=1200)

        response = client.put(f"{RUNS}/{uuid.uuid4()}", json=body, headers=headers)

        assert response.status_code == 422
        assert "elapsed_s" in response.text

    def test_일시정지가_있어_경과_시간이_더_짧은_것은_받는다(self, client: TestClient, headers: dict):
        body = run_body(ended_at=(STARTED + timedelta(minutes=40)).isoformat(), elapsed_s=1200)
        assert client.put(f"{RUNS}/{uuid.uuid4()}", json=body, headers=headers).status_code == 201

    def test_아주_천천히_걸은_기록의_페이스도_받는다(self, client: TestClient, headers: dict):
        # 20분에 0.1km = km당 12000초. 앱은 페이스에 상한을 두지 않는다.
        body = run_body(distance_m=100.0, avg_pace_s_per_km=12000.0)
        assert client.put(f"{RUNS}/{uuid.uuid4()}", json=body, headers=headers).status_code == 201

    def test_NaN과_무한대는_받지_않는다(self, client: TestClient, headers: dict):
        for bad in ("NaN", "Infinity"):
            raw = json.dumps(run_body()).replace("3200.5", bad)
            response = client.put(
                f"{RUNS}/{uuid.uuid4()}", content=raw, headers={**headers, "Content-Type": "application/json"}
            )
            assert response.status_code == 422, bad

    def test_목표값이_틀리면_어느_칸인지_문구에_담는다(self, client: TestClient, headers: dict):
        response = client.put(f"{RUNS}/{uuid.uuid4()}", json=run_body(config={"run_sec": 60}), headers=headers)

        assert response.status_code == 422
        assert "config.walk_sec" in response.text and "config.repeats" in response.text

    def test_로그인_확인_직후_회원이_지워졌으면_401(self, db: Session):
        """user_id 외래키 위반을 500으로 내보내지 않는다."""
        from app.errors import AppError
        from app.models import User
        from app.schemas.run import RunIn
        from app.services import run_service

        ghost = User(id=uuid.uuid4(), email="ghost@example.com", password_hash="x", weekly_goal=3)

        with pytest.raises(AppError) as raised:
            run_service.upsert_run(db, ghost, uuid.uuid4(), RunIn.model_validate(run_body()))

        assert raised.value.status_code == 401


class TestBodySizeLimit:
    def test_너무_큰_요청은_본문을_읽기_전에_413으로_돌려보낸다(self, client: TestClient, headers: dict):
        huge = "x" * (2 * 1024 * 1024 + 1)

        response = client.put(
            f"{RUNS}/{uuid.uuid4()}", content=huge, headers={**headers, "Content-Type": "application/json"}
        )

        assert response.status_code == 413
        assert error_code(response) == "PAYLOAD_TOO_LARGE"

    def test_로그인하지_않은_큰_요청도_413이다(self, client: TestClient):
        """본문 읽기는 로그인 확인보다 먼저라서, 크기 상한이 없으면 누구나 큰 본문으로 서버 메모리를 쓰게 할 수 있다."""
        huge = "x" * (2 * 1024 * 1024 + 1)
        response = client.put(f"{RUNS}/{uuid.uuid4()}", content=huge, headers={"Content-Type": "application/json"})
        assert response.status_code == 413

    def test_413_응답에도_CORS_헤더가_붙는다(self, client: TestClient):
        huge = "x" * (2 * 1024 * 1024 + 1)
        response = client.put(
            f"{RUNS}/{uuid.uuid4()}",
            content=huge,
            headers={"Content-Type": "application/json", "Origin": "http://localhost:5173"},
        )
        assert response.status_code == 413
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

    def test_경로_20000점짜리_정상_요청은_상한_안이다(self, client: TestClient, headers: dict):
        route = [[37.5 + i * 0.00001, 127.0 + i * 0.00001, i] for i in range(20_000)]
        body = run_body(route=route, elapsed_s=20_000, ended_at=(STARTED + timedelta(seconds=20_000)).isoformat())
        assert client.put(f"{RUNS}/{uuid.uuid4()}", json=body, headers=headers).status_code == 201
