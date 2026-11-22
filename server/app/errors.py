"""에러 응답을 한 가지 모양으로 맞춘다.

    {"detail": {"code": "EMAIL_TAKEN", "message": "이미 가입된 이메일이에요"}}

앱과 웹은 code로 분기하고 message를 사용자에게 보여 준다(overview/api-list.md).
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("pacerun")


class AppError(Exception):
    """서비스가 던지는 "예상한 실패". 라우터가 아니라 서비스가 던지므로 HTTP를 몰라도 되게 코드만 갖는다."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def unauthorized(message: str = "로그인이 필요해요", code: str = "UNAUTHORIZED") -> AppError:
    return AppError(status.HTTP_401_UNAUTHORIZED, code, message)


def _body(code: str, message: str, **extra: object) -> dict[str, object]:
    return {"detail": {"code": code, "message": message, **extra}}


_STATUS_CODES = {
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, error: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if error.status_code == status.HTTP_401_UNAUTHORIZED else None
        return JSONResponse(_body(error.code, error.message), status_code=error.status_code, headers=headers)

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
        message = error.detail if isinstance(error.detail, str) else "요청을 처리하지 못했어요"
        return JSONResponse(_body(code, message), status_code=error.status_code, headers=error.headers)

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, error: Exception) -> JSONResponse:
        # 내부 사정(스택, SQL)은 로그에만 남기고 응답에는 넣지 않는다
        logger.exception("처리하지 못한 오류: %s %s", request.method, request.url.path, exc_info=error)
        return JSONResponse(
            _body("INTERNAL", "서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요"),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
