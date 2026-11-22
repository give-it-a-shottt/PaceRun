"""FastAPI 앱을 조립한다: CORS, 에러 형식, 라우터."""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import register_error_handlers
from app.routers import auth, me

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Pace Run API", version="1.0.0")

    # 순서가 중요하다: 나중에 추가한 미들웨어가 바깥을 감싼다.
    # 에러 처리를 먼저, CORS를 나중에 추가해야 500 응답에도 CORS 헤더가 붙는다.
    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        # 쿠키를 주고받으려면 "*"가 아니라 주소를 정확히 적어야 한다
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Refresh-Mode"],
    )

    api = APIRouter(prefix=API_PREFIX)
    api.include_router(auth.router)
    api.include_router(me.router)
    app.include_router(api)

    @app.get("/health", include_in_schema=False)
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
