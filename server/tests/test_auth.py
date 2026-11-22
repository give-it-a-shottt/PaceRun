from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import RefreshToken, User
from app.security import create_access_token, hash_refresh_token
from tests.conftest import EMAIL, PASSWORD, auth_header

SIGNUP = "/api/v1/auth/signup"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/me"
COOKIE_MODE = {"X-Refresh-Mode": "cookie"}


def error_code(response) -> str:
    return response.json()["detail"]["code"]


class TestSignup:
    def test_가입하면_회원과_토큰을_돌려준다(self, client: TestClient, db: Session):
        response = client.post(SIGNUP, json={"email": EMAIL, "password": PASSWORD})

        assert response.status_code == 201
        body = response.json()
        assert body["user"]["email"] == EMAIL
        assert body["user"]["weekly_goal"] == 3
        assert body["token_type"] == "bearer"
        assert body["expires_in"] == 30 * 60
        assert body["access_token"] and body["refresh_token"]
        assert "password" not in str(body)

    def test_비밀번호는_해시로만_저장한다(self, client: TestClient, db: Session):
        client.post(SIGNUP, json={"email": EMAIL, "password": PASSWORD})

        user = db.scalar(select(User).where(User.email == EMAIL))
        assert user is not None
        assert user.password_hash != PASSWORD
        assert user.password_hash.startswith("$argon2")

    def test_이메일은_소문자로_저장하고_대소문자만_다른_중복을_막는다(self, client: TestClient, db: Session):
        first = client.post(SIGNUP, json={"email": "Runner@Example.com", "password": PASSWORD})
        assert first.json()["user"]["email"] == "runner@example.com"

        second = client.post(SIGNUP, json={"email": "RUNNER@example.com", "password": PASSWORD})
        assert second.status_code == 409
        assert error_code(second) == "EMAIL_TAKEN"
        assert db.scalar(select(func.count()).select_from(User)) == 1

    def test_확인과_저장_사이에_같은_이메일이_먼저_가입되면_409(
        self, client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
    ):
        """두 요청이 동시에 같은 이메일로 가입하는 경쟁. 사전 확인은 둘 다 통과하고 DB의 UNIQUE가 막는다."""
        from app.services import auth_service

        real_hash = auth_service.hash_password

        def hash_and_let_another_request_win(password: str) -> str:
            # 사전 확인이 끝난 뒤, 다른 요청이 같은 이메일로 먼저 가입한 상황을 만든다
            db.add(User(email=EMAIL, password_hash=real_hash("someone-else-pass")))
            return real_hash(password)

        monkeypatch.setattr(auth_service, "hash_password", hash_and_let_another_request_win)

        response = client.post(SIGNUP, json={"email": EMAIL, "password": PASSWORD})

        assert response.status_code == 409
        assert error_code(response) == "EMAIL_TAKEN"

    def test_짧은_비밀번호와_잘못된_이메일은_422(self, client: TestClient):
        short = client.post(SIGNUP, json={"email": EMAIL, "password": "1234567"})
        assert short.status_code == 422
        assert error_code(short) == "VALIDATION"
        assert short.json()["detail"]["fields"][0]["field"] == "password"
        # 받은 비밀번호를 응답에 되돌려 주지 않는다
        assert "1234567" not in short.text

        bad_email = client.post(SIGNUP, json={"email": "not-an-email", "password": PASSWORD})
        assert bad_email.status_code == 422

    def test_너무_긴_비밀번호는_422(self, client: TestClient):
        response = client.post(SIGNUP, json={"email": EMAIL, "password": "a" * 73})
        assert response.status_code == 422


class TestLogin:
    def test_맞는_이메일과_비밀번호로_로그인한다(self, client: TestClient, signed_up: dict):
        response = client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})

        assert response.status_code == 200
        assert response.json()["user"]["id"] == signed_up["user"]["id"]

    def test_이메일_대소문자가_달라도_로그인된다(self, client: TestClient, signed_up: dict):
        response = client.post(LOGIN, json={"email": EMAIL.upper(), "password": PASSWORD})
        assert response.status_code == 200

    def test_비밀번호가_틀리거나_없는_이메일이면_같은_401을_준다(self, client: TestClient, signed_up: dict):
        wrong_password = client.post(LOGIN, json={"email": EMAIL, "password": "wrong-password"})
        unknown_email = client.post(LOGIN, json={"email": "nobody@example.com", "password": PASSWORD})

        assert wrong_password.status_code == unknown_email.status_code == 401
        # 가입 여부를 알 수 없게 두 경우의 응답이 같다
        assert wrong_password.json() == unknown_email.json()
        assert error_code(wrong_password) == "INVALID_CREDENTIALS"


class TestMe:
    def test_토큰으로_내_정보를_읽는다(self, client: TestClient, signed_up: dict):
        response = client.get(ME, headers=auth_header(signed_up["access_token"]))

        assert response.status_code == 200
        assert response.json() == signed_up["user"]

    def test_토큰이_없거나_틀리면_401(self, client: TestClient, signed_up: dict):
        assert client.get(ME).status_code == 401
        assert error_code(client.get(ME)) == "UNAUTHORIZED"
        assert client.get(ME, headers=auth_header("not-a-token")).status_code == 401
        # 리프레시 토큰은 액세스 토큰 자리에 쓸 수 없다
        assert client.get(ME, headers=auth_header(signed_up["refresh_token"])).status_code == 401

    def test_만료된_토큰은_401(self, client: TestClient, signed_up: dict):
        long_ago = datetime.now(UTC) - timedelta(hours=2)
        expired, _ = create_access_token(signed_up["user"]["id"], now=long_ago)

        response = client.get(ME, headers=auth_header(expired))
        assert response.status_code == 401

    def test_지워진_회원의_토큰은_401(self, client: TestClient, db: Session, signed_up: dict):
        db.delete(db.get(User, signed_up["user"]["id"]))
        db.commit()

        assert client.get(ME, headers=auth_header(signed_up["access_token"])).status_code == 401

    def test_주_목표를_바꾼다(self, client: TestClient, signed_up: dict):
        headers = auth_header(signed_up["access_token"])

        response = client.patch(ME, json={"weekly_goal": 5}, headers=headers)
        assert response.status_code == 200
        assert response.json()["weekly_goal"] == 5
        assert client.get(ME, headers=headers).json()["weekly_goal"] == 5

    def test_주_목표는_2에서_5까지만(self, client: TestClient, signed_up: dict):
        headers = auth_header(signed_up["access_token"])
        assert client.patch(ME, json={"weekly_goal": 1}, headers=headers).status_code == 422
        assert client.patch(ME, json={"weekly_goal": 6}, headers=headers).status_code == 422
        assert client.patch(ME, json={"weekly_goal": 3}).status_code == 401


class TestRefresh:
    def test_리프레시_토큰으로_새_토큰을_받고_예전_토큰은_못_쓴다(self, client: TestClient, signed_up: dict):
        old = signed_up["refresh_token"]

        response = client.post(REFRESH, json={"refresh_token": old})
        assert response.status_code == 200
        new = response.json()
        assert new["refresh_token"] != old
        assert client.get(ME, headers=auth_header(new["access_token"])).status_code == 200

        reused = client.post(REFRESH, json={"refresh_token": old})
        assert reused.status_code == 401
        assert error_code(reused) == "INVALID_REFRESH"

    def test_한참_전에_쓴_토큰이_다시_오면_그_회원의_토큰을_모두_끊는다(
        self, client: TestClient, db: Session, signed_up: dict
    ):
        old = signed_up["refresh_token"]
        new = client.post(REFRESH, json={"refresh_token": old}).json()["refresh_token"]
        # 교체된 지 1분이 지난 것으로 만든다(동시 요청으로 보는 10초를 넘김)
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == hash_refresh_token(old))
            .values(revoked_at=datetime.now(UTC) - timedelta(minutes=1))
        )
        db.commit()

        # 새어 나간 예전 토큰을 누군가 다시 쓴 상황
        assert client.post(REFRESH, json={"refresh_token": old}).status_code == 401
        # 정상적으로 받은 새 토큰도 이제 못 쓴다 → 다시 로그인해야 한다
        assert client.post(REFRESH, json={"refresh_token": new}).status_code == 401
        active = db.scalar(select(func.count()).select_from(RefreshToken).where(RefreshToken.revoked_at.is_(None)))
        assert active == 0

    def test_방금_교체된_토큰이_바로_다시_오면_401만_주고_새_토큰은_살려_둔다(
        self, client: TestClient, signed_up: dict
    ):
        """브라우저 탭 두 개가 같은 토큰으로 동시에 갱신한 경우: 늦은 요청만 실패하고 로그인은 유지된다."""
        old = signed_up["refresh_token"]
        new = client.post(REFRESH, json={"refresh_token": old}).json()["refresh_token"]

        late = client.post(REFRESH, json={"refresh_token": old})

        assert late.status_code == 401
        assert error_code(late) == "INVALID_REFRESH"
        assert client.post(REFRESH, json={"refresh_token": new}).status_code == 200

    def test_토큰을_새로_줄_때_만료됐거나_오래전에_교체된_줄을_지운다(
        self, client: TestClient, db: Session, signed_up: dict
    ):
        token = signed_up["refresh_token"]
        long_ago = datetime.now(UTC) - timedelta(days=2)
        for _ in range(3):
            token = client.post(REFRESH, json={"refresh_token": token}).json()["refresh_token"]
        db.execute(update(RefreshToken).where(RefreshToken.revoked_at.is_not(None)).values(revoked_at=long_ago))
        db.commit()

        client.post(REFRESH, json={"refresh_token": token})

        # 방금 교체된 줄 1개 + 새 토큰 1개만 남는다
        assert db.scalar(select(func.count()).select_from(RefreshToken)) == 2

    def test_만료된_리프레시_토큰은_401(self, client: TestClient, db: Session, signed_up: dict):
        token = signed_up["refresh_token"]
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == hash_refresh_token(token))
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
        db.commit()

        assert client.post(REFRESH, json={"refresh_token": token}).status_code == 401

    def test_토큰이_없거나_모르는_토큰이면_401(self, client: TestClient):
        assert client.post(REFRESH).status_code == 401
        assert client.post(REFRESH, json={}).status_code == 401
        assert client.post(REFRESH, json={"refresh_token": "unknown"}).status_code == 401

    def test_DB에는_토큰_원문이_아니라_해시만_있다(self, client: TestClient, db: Session, signed_up: dict):
        stored = db.scalars(select(RefreshToken.token_hash)).all()
        assert stored == [hash_refresh_token(signed_up["refresh_token"])]
        assert signed_up["refresh_token"] not in stored


class TestCookieMode:
    """웹: 리프레시 토큰을 응답 본문이 아니라 httpOnly 쿠키로만 받는다."""

    def test_쿠키_방식이면_본문에_리프레시_토큰이_없고_httpOnly_쿠키로_온다(self, client: TestClient):
        response = client.post(SIGNUP, json={"email": EMAIL, "password": PASSWORD}, headers=COOKIE_MODE)

        assert response.status_code == 201
        assert response.json()["refresh_token"] is None
        set_cookie = response.headers["set-cookie"]
        assert set_cookie.startswith("pr_refresh=")
        assert "HttpOnly" in set_cookie
        assert "SameSite=lax" in set_cookie
        assert "Path=/api/v1/auth" in set_cookie

    def test_쿠키만으로_갱신되고_쿠키가_새_토큰으로_바뀐다(self, client: TestClient):
        client.post(SIGNUP, json={"email": EMAIL, "password": PASSWORD}, headers=COOKIE_MODE)
        before = client.cookies.get("pr_refresh")

        response = client.post(REFRESH, headers=COOKIE_MODE)

        assert response.status_code == 200
        assert response.json()["refresh_token"] is None
        assert client.cookies.get("pr_refresh") not in (None, before)
        assert client.get(ME, headers=auth_header(response.json()["access_token"])).status_code == 200

    def test_쿠키가_없으면_쿠키_방식_갱신은_401(self, client: TestClient):
        assert client.post(REFRESH, headers=COOKIE_MODE).status_code == 401

    def test_못_쓰는_쿠키로_갱신하면_401과_함께_쿠키를_지운다(self, client: TestClient):
        client.cookies.set("pr_refresh", "unknown-token", path="/api/v1/auth")

        response = client.post(REFRESH, headers=COOKIE_MODE)

        assert response.status_code == 401
        assert error_code(response) == "INVALID_REFRESH"
        assert 'pr_refresh=""' in response.headers["set-cookie"]
        assert "Max-Age=0" in response.headers["set-cookie"]

    def test_로그아웃하면_쿠키를_지우고_토큰을_못_쓰게_한다(self, client: TestClient):
        client.post(SIGNUP, json={"email": EMAIL, "password": PASSWORD}, headers=COOKIE_MODE)
        token = client.cookies.get("pr_refresh")

        response = client.post(LOGOUT)

        assert response.status_code == 204
        assert client.cookies.get("pr_refresh") is None
        client.cookies.set("pr_refresh", token, path="/api/v1/auth")
        assert client.post(REFRESH, headers=COOKIE_MODE).status_code == 401


class TestLogout:
    def test_앱은_본문의_토큰으로_로그아웃한다(self, client: TestClient, signed_up: dict):
        token = signed_up["refresh_token"]

        assert client.post(LOGOUT, json={"refresh_token": token}).status_code == 204
        assert client.post(REFRESH, json={"refresh_token": token}).status_code == 401

    def test_토큰_없이_불러도_204(self, client: TestClient):
        assert client.post(LOGOUT).status_code == 204
        assert client.post(LOGOUT, json={"refresh_token": "unknown"}).status_code == 204

    def test_로그아웃한_토큰이_나중에_다시_와도_다른_기기는_로그아웃되지_않는다(
        self, client: TestClient, signed_up: dict
    ):
        phone = signed_up["refresh_token"]
        laptop = client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD}).json()["refresh_token"]
        client.post(LOGOUT, json={"refresh_token": phone})

        # 로그아웃한 폰의 예전 토큰이 다시 온다(오래된 화면 등)
        assert client.post(REFRESH, json={"refresh_token": phone}).status_code == 401
        # 노트북의 로그인은 그대로다
        assert client.post(REFRESH, json={"refresh_token": laptop}).status_code == 200


class TestErrorFormat:
    def test_예상하지_못한_오류는_내부_사정_없이_500_INTERNAL로_답한다(self):
        from app.db import get_db
        from app.main import app

        def broken_db():
            raise RuntimeError("connection refused: db-host:5432 secret-detail")

        app.dependency_overrides[get_db] = broken_db
        try:
            # raise_server_exceptions=False: 테스트 클라이언트가 예외를 다시 던지지 않고 실제 응답을 돌려주게 한다
            with TestClient(app, raise_server_exceptions=False) as raw_client:
                response = raw_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 500
        assert error_code(response) == "INTERNAL"
        assert "db-host" not in response.text and "secret-detail" not in response.text

    def test_없는_주소는_우리_에러_형식의_404(self, client: TestClient):
        response = client.get("/api/v1/nope")
        assert response.status_code == 404
        assert error_code(response) == "NOT_FOUND"

    def test_허용하지_않은_출처에는_CORS_헤더를_주지_않는다(self, client: TestClient):
        allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert allowed.headers["access-control-allow-credentials"] == "true"

        other = client.get("/health", headers={"Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in other.headers
