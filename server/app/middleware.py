"""앱 전체에 거는 미들웨어."""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.errors import error_response

# 가장 큰 정상 요청은 러닝 올리기다: 경로 20000점 × 약 40바이트 ≈ 0.8MB. 그 두 배 남짓을 상한으로 둔다.
MAX_BODY_BYTES = 2 * 1024 * 1024


class BodySizeLimitMiddleware:
    """너무 큰 요청 본문을 돌려보낸다.

    칸마다의 길이 검사(예: 경로 20000점)는 본문을 다 읽고 푼 뒤에야 돌고, 본문 읽기는 로그인 확인보다 먼저다.
    그래서 로그인하지 않은 사람도 아주 큰 본문을 보내 서버 메모리를 쓰게 할 수 있다. 여기서 먼저 막는다.

    1. 머리글로 거른다 — 길이를 밝히지 않는 조각 전송은 411, 밝힌 길이가 상한을 넘으면 413. 본문을 읽기 전이다.
    2. 실제로 받은 바이트를 센다 — 머리글이 거짓이거나 없어도 상한을 넘는 순간 413으로 끊는다.
    """

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {name.lower(): value for name, value in scope["headers"]}
        # Content-Length보다 먼저 본다. 두 머리글이 함께 오면 서버는 조각 전송 쪽을 따를 수 있어,
        # 작은 Content-Length를 같이 달아 아래 검사를 피해 가는 길이 생긴다.
        if b"transfer-encoding" in headers:
            await error_response(411, "LENGTH_REQUIRED", "요청 본문의 크기를 알 수 없어요")(scope, receive, send)
            return
        length = headers.get(b"content-length")
        if length is not None and (not length.isdigit() or int(length) > self.max_bytes):
            await self._too_large(scope, receive, send)
            return

        received = 0
        over_limit = False
        response_started = False

        async def counting_receive() -> Message:
            nonlocal received, over_limit
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    over_limit = True
                    # 앱에는 "연결이 끊겼다"고 알려 본문을 더 읽지 않게 한다
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message: Message) -> None:
            nonlocal response_started
            if over_limit and not response_started:
                return  # 끊김을 본 앱이 내는 응답은 버린다. 아래에서 413을 보낸다.
            response_started = response_started or message["type"] == "http.response.start"
            await send(message)

        try:
            await self.app(scope, counting_receive, guarded_send)
        except Exception:
            if not over_limit:
                raise
        if over_limit and not response_started:
            await self._too_large(scope, receive, send)

    async def _too_large(self, scope: Scope, receive: Receive, send: Send) -> None:
        await error_response(413, "PAYLOAD_TOO_LARGE", "요청이 너무 커요")(scope, receive, send)
