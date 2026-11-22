"""앱 전체에 거는 미들웨어."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# 가장 큰 정상 요청은 러닝 올리기다: 경로 20000점 × 약 40바이트 ≈ 0.8MB. 그 두 배 남짓을 상한으로 둔다.
MAX_BODY_BYTES = 2 * 1024 * 1024


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"detail": {"code": code, "message": message}}, status_code=status_code)


class BodySizeLimitMiddleware:
    """너무 큰 요청 본문을 읽기 전에 돌려보낸다.

    칸마다의 길이 검사(예: 경로 20000점)는 본문을 다 읽고 푼 뒤에야 돌고, 본문 읽기는 로그인 확인보다 먼저다.
    그래서 로그인하지 않은 사람도 아주 큰 본문을 보내 서버 메모리를 쓰게 할 수 있다. 여기서 먼저 막는다.
    """

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {name.lower(): value for name, value in scope["headers"]}
        length = headers.get(b"content-length")
        if length is None:
            # 길이를 밝히지 않고 조각으로 보내는 본문은 끝까지 읽어 봐야 크기를 안다. 받지 않는다.
            if b"chunked" in headers.get(b"transfer-encoding", b"").lower():
                await _error(411, "LENGTH_REQUIRED", "요청 본문의 크기를 알 수 없어요")(scope, receive, send)
                return
        elif not length.isdigit() or int(length) > self.max_bytes:
            await _error(413, "PAYLOAD_TOO_LARGE", "요청이 너무 커요")(scope, receive, send)
            return

        await self.app(scope, receive, send)
