"""요청 본문 크기 상한(app/middleware.py).

TestClient는 Content-Length를 스스로 정확히 붙여 보내므로, "길이를 속이거나 밝히지 않는 요청"은
ASGI 메시지를 직접 만들어 넣어 확인한다.
"""

import asyncio
import json
import uuid

from fastapi.testclient import TestClient
from starlette.responses import JSONResponse
from starlette.types import Message, Receive, Scope, Send

from app.main import app as real_app
from app.middleware import MAX_BODY_BYTES, BodySizeLimitMiddleware

LIMIT = 10


def send_request(app, headers: dict[str, str], chunks: list[bytes], path: str = "/", method: str = "PUT") -> dict:
    """ASGI 앱에 요청 하나를 넣고 {"status", "body"}를 돌려준다."""
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [(name.lower().encode(), value.encode()) for name, value in headers.items()],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    pending = list(chunks)
    result: dict = {"status": None, "body": b""}

    async def receive() -> Message:
        if not pending:
            return {"type": "http.disconnect"}
        body = pending.pop(0)
        return {"type": "http.request", "body": body, "more_body": bool(pending)}

    async def send(message: Message) -> None:
        if message["type"] == "http.response.start":
            assert result["status"] is None, "응답을 두 번 시작했다"
            result["status"] = message["status"]
        elif message["type"] == "http.response.body":
            result["body"] += message.get("body", b"")

    asyncio.run(app(scope, receive, send))
    return result


def error_code(result: dict) -> str:
    return json.loads(result["body"])["detail"]["code"]


class _Echo:
    """본문을 끝까지 읽고 읽은 바이트 수를 돌려주는 가짜 앱."""

    def __init__(self) -> None:
        self.called = False
        self.read = 0

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        self.called = True
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            self.read += len(message.get("body", b""))
            if not message.get("more_body"):
                break
        await JSONResponse({"read": self.read})(scope, receive, send)


def limited() -> tuple[BodySizeLimitMiddleware, _Echo]:
    inner = _Echo()
    return BodySizeLimitMiddleware(inner, max_bytes=LIMIT), inner


class TestHeaders:
    def test_상한_안의_요청은_그대로_지나간다(self):
        middleware, inner = limited()

        result = send_request(middleware, {"Content-Length": "10"}, [b"x" * 10])

        assert result["status"] == 200
        assert inner.read == 10

    def test_Content_Length가_상한을_넘으면_앱을_부르지_않고_413(self):
        middleware, inner = limited()

        result = send_request(middleware, {"Content-Length": "11"}, [b"x" * 11])

        assert result["status"] == 413
        assert error_code(result) == "PAYLOAD_TOO_LARGE"
        assert inner.called is False

    def test_Content_Length가_숫자가_아니면_413(self):
        middleware, inner = limited()
        assert send_request(middleware, {"Content-Length": "-1"}, [b"x"])["status"] == 413
        assert inner.called is False

    def test_조각_전송은_411(self):
        middleware, inner = limited()

        result = send_request(middleware, {"Transfer-Encoding": "chunked"}, [b"x"])

        assert result["status"] == 411
        assert error_code(result) == "LENGTH_REQUIRED"
        assert inner.called is False

    def test_작은_Content_Length와_조각_전송을_함께_보내도_411(self):
        """Content-Length만 믿으면, 두 머리글을 함께 보내 상한을 피해 갈 수 있다."""
        middleware, inner = limited()

        result = send_request(middleware, {"Content-Length": "5", "Transfer-Encoding": "chunked"}, [b"x" * 100])

        assert result["status"] == 411
        assert inner.called is False

    def test_본문이_없는_요청은_지나간다(self):
        middleware, _ = limited()
        assert send_request(middleware, {}, [b""], method="GET")["status"] == 200

    def test_HTTP가_아닌_연결은_건드리지_않는다(self):
        seen = []

        async def inner(scope: Scope, receive: Receive, send: Send) -> None:
            seen.append(scope["type"])

        asyncio.run(BodySizeLimitMiddleware(inner, max_bytes=LIMIT)({"type": "lifespan"}, None, None))

        assert seen == ["lifespan"]


class TestCountsRealBytes:
    """머리글이 거짓이거나 없어도, 실제로 받은 바이트가 상한을 넘으면 끊는다."""

    def test_Content_Length보다_본문이_길면_413(self):
        middleware, inner = limited()

        result = send_request(middleware, {"Content-Length": "5"}, [b"x" * 6, b"x" * 6, b"x" * 6])

        assert result["status"] == 413
        assert error_code(result) == "PAYLOAD_TOO_LARGE"
        # 상한을 넘긴 조각까지만 받고 그 뒤는 읽지 않는다
        assert inner.read <= LIMIT

    def test_길이를_밝히지_않은_큰_본문도_413(self):
        middleware, _ = limited()
        assert send_request(middleware, {}, [b"x" * 6, b"x" * 6])["status"] == 413

    def test_실제_앱에서도_길이를_속인_큰_본문은_413이다(self):
        """본문 읽기는 로그인 확인보다 먼저라, 토큰이 없어도 413이어야 한다."""
        chunk = b"x" * (512 * 1024)
        chunks = [chunk] * (MAX_BODY_BYTES // len(chunk) + 1)

        result = send_request(
            real_app,
            {"Content-Length": "10", "Content-Type": "application/json"},
            chunks,
            path=f"/api/v1/runs/{uuid.uuid4()}",
        )

        assert result["status"] == 413
        assert error_code(result) == "PAYLOAD_TOO_LARGE"


class TestThroughClient:
    def test_조각으로_보낸_요청은_411이고_CORS_헤더가_붙는다(self, client: TestClient):
        # 본문을 제너레이터로 주면 클라이언트가 길이 대신 Transfer-Encoding: chunked를 붙인다
        response = client.put(
            f"/api/v1/runs/{uuid.uuid4()}",
            content=iter([b"{}"]),
            headers={"Content-Type": "application/json", "Origin": "http://localhost:5173"},
        )

        assert response.status_code == 411
        assert response.json()["detail"]["code"] == "LENGTH_REQUIRED"
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
