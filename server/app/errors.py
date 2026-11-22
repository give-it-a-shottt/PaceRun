"""에러 응답을 한 가지 모양으로 맞춘다.

    {"detail": {"code": "EMAIL_TAKEN", "message": "이미 가입된 이메일이에요"}}

앱과 웹은 code로 분기하고 message를 사용자에게 보여 준다(overview/api-list.md).
"""

import logging

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import RequestResponseEndpoint

logger = logging.getLogger("pacerun")


class AppError(Exception):
    """서비스가 던지는 "예상한 실패"(이미 가입된 이메일, 틀린 비밀번호 등).

    응답으로 바꾸는 일은 아래 핸들러 한 곳이 맡는다. 그래서 서비스는 상태 코드 · 코드 · 문구만 정해 던지면 되고,
    요청 · 응답 객체나 쿠키를 다룰 필요가 없다.
    """

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def unauthorized(message: str = "로그인이 필요해요") -> AppError:
    """액세스 토큰이 없거나 못 쓰는 경우의 401. (로그인 · 갱신 실패는 코드가 달라 서비스가 직접 만든다)"""
    return AppError(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", message)


def _body(code: str, message: str, **extra: object) -> dict[str, object]:
    return {"detail": {"code": code, "message": message, **extra}}


_STATUS_CODES = {
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
}

_STATUS_MESSAGES = {
    status.HTTP_401_UNAUTHORIZED: "로그인이 필요해요",
    status.HTTP_403_FORBIDDEN: "권한이 없어요",
    status.HTTP_404_NOT_FOUND: "요청한 주소를 찾을 수 없어요",
    status.HTTP_405_METHOD_NOT_ALLOWED: "이 주소에서는 쓸 수 없는 요청 방식이에요",
}


def app_error_response(error: AppError) -> JSONResponse:
    """AppError를 응답으로 바꾼다. 라우터가 응답에 쿠키 삭제 같은 것을 더해야 할 때도 이 함수를 쓴다."""
    headers = {"WWW-Authenticate": "Bearer"} if error.status_code == status.HTTP_401_UNAUTHORIZED else None
    return JSONResponse(_body(error.code, error.message), status_code=error.status_code, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, error: AppError) -> JSONResponse:
        return app_error_response(error)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, error: RequestValidationError) -> JSONResponse:
        # 어떤 칸이 왜 틀렸는지만 돌려준다. 받은 값(input)은 비밀번호일 수 있어 응답에 넣지 않는다.
        fields = [
            {"field": ".".join(str(part) for part in item["loc"] if part != "body"), "message": item["msg"]}
            for item in error.errors()
        ]
        return JSONResponse(
            _body("VALIDATION", "입력한 값을 확인해 주세요", fields=fields),
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(_: Request, error: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(error.status_code, "HTTP_ERROR")
        # 프레임워크가 낸 오류(없는 주소 등)의 문구는 영어 기본값이라 우리 문구로 바꾼다
        message = _STATUS_MESSAGES.get(error.status_code, "요청을 처리하지 못했어요")
        return JSONResponse(_body(code, message), status_code=error.status_code, headers=error.headers)

    @app.middleware("http")
    async def catch_unexpected(request: Request, call_next: RequestResponseEndpoint) -> Response:
        """예상하지 못한 오류를 500 INTERNAL 응답으로 바꾼다.

        예외 핸들러(@app.exception_handler(Exception))로 두면 CORS 처리보다 바깥에서 응답이 만들어져
        CORS 헤더가 빠지고, 웹에서는 500이 아니라 "네트워크 오류"로 보인다. 그래서 미들웨어로 둔다.
        (main.py에서 CORS 미들웨어를 이것보다 나중에 추가해 바깥을 감싸게 한다.)
        """
        try:
            return await call_next(request)
        except Exception:
            # 내부 사정(스택, SQL)은 로그에만 남기고 응답에는 넣지 않는다
            logger.exception("처리하지 못한 오류: %s %s", request.method, request.url.path)
            return JSONResponse(
                _body("INTERNAL", "서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요"),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
