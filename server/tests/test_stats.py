import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from tests.conftest import PASSWORD, auth_header

RUNS = "/api/v1/runs"
STATS = "/api/v1/stats"
ME = "/api/v1/me"
SEOUL = ZoneInfo("Asia/Seoul")


@pytest.fixture
def headers(signed_up: dict) -> dict[str, str]:
    return auth_header(signed_up["access_token"])


def upload(client: TestClient, headers: dict, started: datetime, elapsed_s: int = 1200, distance_m: float = 3000.0):
    """started(시간대 포함)에 시작한 자유 러닝 한 건을 올린다."""
    body = {
        "mode": "free",
        "config": {"target_duration_sec": None},
        "started_at": started.isoformat(),
        "ended_at": (started + timedelta(seconds=elapsed_s)).isoformat(),
        "elapsed_s": elapsed_s,
        "distance_m": distance_m,
    }
    response = client.put(f"{RUNS}/{uuid.uuid4()}", json=body, headers=headers)
    assert response.status_code == 201, response.text


def seoul(year: int, month: int, day: int, hour: int = 7) -> datetime:
    return datetime(year, month, day, hour, tzinfo=SEOUL)


class TestMonth:
    def test_날짜별로_묶고_기록이_없는_날도_0으로_채운다(self, client: TestClient, headers: dict):
        upload(client, headers, seoul(2026, 11, 3), distance_m=3000)
        upload(client, headers, seoul(2026, 11, 3, 20), distance_m=2000)
        upload(client, headers, seoul(2026, 11, 5), distance_m=5000)

        response = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers)

        assert response.status_code == 200
        body = response.json()
        assert (body["period"], body["start"], body["end"]) == ("month", "2026-11-01", "2026-12-01")
        assert len(body["buckets"]) == 30
        third = body["buckets"][2]
        assert third == {"label": "3", "start": "2026-11-03", "distance_m": 5000.0, "count": 2, "elapsed_s": 2400}
        assert body["buckets"][3]["count"] == 0
        assert body["totals"] == {"distance_m": 10000.0, "count": 3, "elapsed_s": 3600}

    def test_10분을_못_채운_러닝은_거리와_시간에는_들어가고_횟수에는_안_들어간다(
        self, client: TestClient, headers: dict
    ):
        upload(client, headers, seoul(2026, 11, 3), elapsed_s=300, distance_m=800)

        body = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()

        assert body["totals"] == {"distance_m": 800.0, "count": 0, "elapsed_s": 300}

    def test_하루의_경계는_사용자_시간대로_나눈다(self, client: TestClient, headers: dict):
        # 한국 시각 11월 1일 아침 7시 = UTC로는 10월 31일 22시
        upload(client, headers, seoul(2026, 11, 1, 7))

        november = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()
        october = client.get(STATS, params={"period": "month", "anchor": "2026-10-15"}, headers=headers).json()
        assert november["buckets"][0]["count"] == 1
        assert october["totals"]["count"] == 0

        # 같은 기록을 UTC 기준으로 보면 10월 31일이다
        october_utc = client.get(
            STATS, params={"period": "month", "anchor": "2026-10-15", "tz": "UTC"}, headers=headers
        ).json()
        assert october_utc["buckets"][30]["count"] == 1

    def test_다른_회원의_기록은_들어가지_않는다(self, client: TestClient, headers: dict):
        other = client.post("/api/v1/auth/signup", json={"email": "other@example.com", "password": PASSWORD})
        upload(client, auth_header(other.json()["access_token"]), seoul(2026, 11, 3))

        body = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()
        assert body["totals"]["count"] == 0


class TestYear:
    def test_월별_12칸으로_묶는다(self, client: TestClient, headers: dict):
        upload(client, headers, seoul(2026, 1, 10), distance_m=1000)
        upload(client, headers, seoul(2026, 11, 3), distance_m=3000)
        upload(client, headers, seoul(2026, 11, 20), distance_m=4000)
        upload(client, headers, seoul(2025, 12, 31))  # 지난해 기록은 빠진다

        body = client.get(STATS, params={"period": "year", "anchor": "2026-06-01"}, headers=headers).json()

        assert (body["start"], body["end"]) == ("2026-01-01", "2027-01-01")
        assert [bucket["label"] for bucket in body["buckets"]] == [f"{month}월" for month in range(1, 13)]
        assert body["buckets"][0]["distance_m"] == 1000.0
        assert body["buckets"][10] == {
            "label": "11월",
            "start": "2026-11-01",
            "distance_m": 7000.0,
            "count": 2,
            "elapsed_s": 2400,
        }
        assert body["totals"]["count"] == 3


class TestGoalWeeks:
    def test_주_목표를_채운_주만_센다(self, client: TestClient, headers: dict):
        # 2026년 11월: 2일(월) 시작 주에 3번, 9일(월) 시작 주에 2번
        for day in (2, 4, 7):
            upload(client, headers, seoul(2026, 11, day))
        for day in (9, 11):
            upload(client, headers, seoul(2026, 11, day))

        body = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()

        assert body["weekly_goal"] == 3
        assert body["goal_weeks"]["achieved"] == 1
        # 10/26 · 11/2 · 9 · 16 · 23 · 30 시작 주 가운데 오늘까지 시작한 주만 센다
        assert 1 <= body["goal_weeks"]["total"] <= 6

    def test_주_목표를_낮추면_달성한_주가_늘어난다(self, client: TestClient, headers: dict):
        for day in (9, 11):
            upload(client, headers, seoul(2026, 11, day))

        before = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()
        client.patch(ME, json={"weekly_goal": 2}, headers=headers)
        after = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()

        assert before["goal_weeks"]["achieved"] == 0
        assert after["goal_weeks"]["achieved"] == 1

    def test_한_주는_월요일_0시에_시작한다(self, client: TestClient, headers: dict):
        # 일요일 밤 11시와 월요일 0시 30분은 다른 주다
        upload(client, headers, datetime(2026, 11, 8, 23, 0, tzinfo=SEOUL))
        upload(client, headers, datetime(2026, 11, 9, 0, 30, tzinfo=SEOUL))
        upload(client, headers, seoul(2026, 11, 10))
        client.patch(ME, json={"weekly_goal": 2}, headers=headers)

        body = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()

        # 9일 시작 주만 2번을 채웠다. 일요일 기록이 그 주로 넘어왔다면 달성 주가 달라진다.
        assert body["goal_weeks"]["achieved"] == 1

    def test_10분을_못_채운_러닝은_주_목표에_세지_않는다(self, client: TestClient, headers: dict):
        client.patch(ME, json={"weekly_goal": 2}, headers=headers)
        upload(client, headers, seoul(2026, 11, 9))
        upload(client, headers, seoul(2026, 11, 10), elapsed_s=300)

        body = client.get(STATS, params={"period": "month", "anchor": "2026-11-15"}, headers=headers).json()
        assert body["goal_weeks"]["achieved"] == 0

    def test_아직_오지_않은_기간은_따져_볼_주가_없다(self, client: TestClient, headers: dict):
        body = client.get(STATS, params={"period": "month", "anchor": "2099-01-15"}, headers=headers).json()
        assert body["goal_weeks"] == {"achieved": 0, "total": 0}


class TestValidation:
    def test_기본값은_이번_달과_서울_시간대다(self, client: TestClient, headers: dict):
        body = client.get(STATS, headers=headers).json()
        today = datetime.now(SEOUL).date()
        assert body["period"] == "month"
        assert body["start"] == today.replace(day=1).isoformat()

    def test_잘못된_값은_422(self, client: TestClient, headers: dict):
        assert client.get(STATS, params={"period": "week"}, headers=headers).status_code == 422
        assert client.get(STATS, params={"anchor": "2026-13-01"}, headers=headers).status_code == 422
        bad_tz = client.get(STATS, params={"tz": "Mars/Olympus"}, headers=headers)
        assert bad_tz.status_code == 422
        assert bad_tz.json()["detail"]["code"] == "VALIDATION"

    def test_로그인하지_않으면_401(self, client: TestClient):
        assert client.get(STATS).status_code == 401


class TestBoundaries:
    """날짜 경계: 월말 · 연말 · 윤년 · 해를 걸치는 주 · 서머타임."""

    def test_12월은_다음_해_1월_1일_전까지다(self, client: TestClient, headers: dict):
        upload(client, headers, seoul(2026, 12, 31, 23))
        upload(client, headers, seoul(2027, 1, 1, 0))  # 다음 해 기록은 빠진다

        body = client.get(STATS, params={"period": "month", "anchor": "2026-12-10"}, headers=headers).json()

        assert (body["start"], body["end"]) == ("2026-12-01", "2027-01-01")
        assert len(body["buckets"]) == 31
        assert body["buckets"][30]["count"] == 1
        assert body["totals"]["count"] == 1

    def test_윤년_2월은_29일까지_평년은_28일까지다(self, client: TestClient, headers: dict):
        upload(client, headers, seoul(2028, 2, 29))

        leap = client.get(STATS, params={"period": "month", "anchor": "2028-02-10"}, headers=headers).json()
        plain = client.get(STATS, params={"period": "month", "anchor": "2027-02-10"}, headers=headers).json()

        assert len(leap["buckets"]) == 29
        assert leap["buckets"][28] == {
            "label": "29",
            "start": "2028-02-29",
            "distance_m": 3000.0,
            "count": 1,
            "elapsed_s": 1200,
        }
        assert leap["end"] == "2028-03-01"
        assert len(plain["buckets"]) == 28

    def test_월말_밤_기록은_그_달에_다음_날_0시_기록은_다음_달에_들어간다(self, client: TestClient, headers: dict):
        upload(client, headers, datetime(2026, 1, 31, 23, 30, tzinfo=SEOUL))
        upload(client, headers, datetime(2026, 2, 1, 0, 0, tzinfo=SEOUL))

        january = client.get(STATS, params={"period": "month", "anchor": "2026-01-15"}, headers=headers).json()
        february = client.get(STATS, params={"period": "month", "anchor": "2026-02-15"}, headers=headers).json()

        assert january["totals"]["count"] == 1 and january["buckets"][30]["count"] == 1
        assert february["totals"]["count"] == 1 and february["buckets"][0]["count"] == 1

    def test_해를_걸치는_주는_그_주_전체로_달성_여부를_본다(self, client: TestClient, headers: dict):
        # 2025-12-29(월) ~ 2026-01-04(일): 12월에 2번, 1월에 1번 → 주 목표 3번 달성
        for started in (seoul(2025, 12, 29), seoul(2025, 12, 31), seoul(2026, 1, 2)):
            upload(client, headers, started)

        january = client.get(STATS, params={"period": "month", "anchor": "2026-01-15"}, headers=headers).json()
        december = client.get(STATS, params={"period": "month", "anchor": "2025-12-15"}, headers=headers).json()
        year_2026 = client.get(STATS, params={"period": "year", "anchor": "2026-06-01"}, headers=headers).json()

        # 1월 통계의 횟수는 1번뿐이지만, 걸친 주는 달성한 주로 센다
        assert january["totals"]["count"] == 1
        assert january["goal_weeks"]["achieved"] == 1
        assert december["goal_weeks"]["achieved"] == 1
        assert year_2026["goal_weeks"]["achieved"] == 1

    def test_서머타임이_끝나_하루가_25시간인_날도_그날로_묶는다(self, client: TestClient, headers: dict):
        new_york = ZoneInfo("America/New_York")
        # 2026-11-01은 뉴욕에서 서머타임이 끝나는 날이다(새벽 2시가 두 번 온다)
        upload(client, headers, datetime(2026, 11, 1, 0, 30, tzinfo=new_york))
        upload(client, headers, datetime(2026, 11, 1, 23, 30, tzinfo=new_york))
        upload(client, headers, datetime(2026, 11, 2, 0, 30, tzinfo=new_york))

        body = client.get(
            STATS, params={"period": "month", "anchor": "2026-11-15", "tz": "America/New_York"}, headers=headers
        ).json()

        assert body["buckets"][0]["count"] == 2
        assert body["buckets"][1]["count"] == 1


class TestAnchorAndTimezone:
    def test_볼_수_있는_범위_밖의_날짜는_500이_아니라_422다(self, client: TestClient, headers: dict):
        for anchor in ("9999-12-31", "9999-01-01", "1999-12-31", "2101-01-01"):
            for period in ("month", "year"):
                response = client.get(STATS, params={"period": period, "anchor": anchor}, headers=headers)
                assert response.status_code == 422, (anchor, period)
                assert response.json()["detail"]["code"] == "VALIDATION"

    def test_범위의_양_끝은_볼_수_있다(self, client: TestClient, headers: dict):
        assert client.get(STATS, params={"anchor": "2000-01-01"}, headers=headers).status_code == 200
        assert client.get(STATS, params={"period": "year", "anchor": "2100-12-31"}, headers=headers).status_code == 200

    def test_시간대_이름이_아닌_값은_422다(self, client: TestClient, headers: dict):
        # "Asia"는 시간대 자료 안의 폴더 이름이라, 걸러 내지 않으면 다른 종류의 오류(500)가 난다
        for tz in ("Asia", "Seoul", "../etc/passwd", "", "Asia/Seoul; DROP TABLE runs"):
            response = client.get(STATS, params={"tz": tz}, headers=headers)
            assert response.status_code == 422, tz
