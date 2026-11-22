"""러닝 요청 · 응답 모양(overview/api-list.md "러닝")."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

RunMode = Literal["free", "interval", "cadence", "pacemaker"]
SegmentKind = Literal["run", "walk", "km"]

# 한 번의 요청이 서버를 무겁게 만들지 못하게 하는 상한
MAX_ELAPSED_S = 24 * 60 * 60
MAX_DISTANCE_M = 300_000
MAX_ROUTE_POINTS = 20_000
MAX_SEGMENTS = 1_000
# 이 시간 이상 뛰어야 주간 횟수 1회로 인정한다(앱의 COUNTED_MIN_ELAPSED_MS와 같은 규칙)
COUNTED_MIN_ELAPSED_S = 10 * 60


class _Strict(BaseModel):
    # 모르는 칸이 오면 조용히 버리지 않고 422로 알려 준다(앱과 서버의 약속이 어긋난 것을 일찍 발견)
    model_config = ConfigDict(extra="forbid")


class FreeConfig(_Strict):
    target_duration_sec: int | None = Field(default=None, gt=0, le=MAX_ELAPSED_S)


class IntervalConfig(_Strict):
    run_sec: int = Field(gt=0, le=3600)
    walk_sec: int = Field(gt=0, le=3600)
    repeats: int = Field(ge=1, le=99)


class CadenceConfig(_Strict):
    spm: int = Field(ge=120, le=220)
    duration_sec: int = Field(gt=0, le=MAX_ELAPSED_S)


class PacemakerConfig(_Strict):
    target_pace_s_per_km: int = Field(gt=0, le=3600)
    distance_m: int = Field(gt=0, le=MAX_DISTANCE_M)


CONFIG_MODELS: dict[str, type[BaseModel]] = {
    "free": FreeConfig,
    "interval": IntervalConfig,
    "cadence": CadenceConfig,
    "pacemaker": PacemakerConfig,
}


class Segment(_Strict):
    idx: int = Field(ge=0)
    kind: SegmentKind
    started_elapsed_s: int = Field(ge=0, le=MAX_ELAPSED_S)
    duration_s: int = Field(ge=0, le=MAX_ELAPSED_S)
    distance_m: float = Field(ge=0, le=MAX_DISTANCE_M)


# 경로의 점 하나: [위도, 경도, 경과 초]
RoutePoint = tuple[
    Annotated[float, Field(ge=-90, le=90)],
    Annotated[float, Field(ge=-180, le=180)],
    Annotated[float, Field(ge=0, le=MAX_ELAPSED_S)],
]


class RunIn(_Strict):
    mode: RunMode
    # 모드에 맞는 목표값. 아래 검사에서 모드별 모양으로 확인한다.
    config: dict[str, Any]
    plan_label: str | None = Field(default=None, max_length=50)
    # 시간대가 붙은 시각만 받는다(붙지 않은 시각은 어느 나라 시각인지 알 수 없다)
    started_at: AwareDatetime
    ended_at: AwareDatetime
    elapsed_s: int = Field(ge=0, le=MAX_ELAPSED_S)
    distance_m: float = Field(ge=0, le=MAX_DISTANCE_M)
    avg_pace_s_per_km: float | None = Field(default=None, gt=0, le=3600)
    segments: list[Segment] = Field(default_factory=list, max_length=MAX_SEGMENTS)
    route: list[RoutePoint] = Field(default_factory=list, max_length=MAX_ROUTE_POINTS)

    @model_validator(mode="after")
    def _check(self) -> "RunIn":
        self.config = CONFIG_MODELS[self.mode].model_validate(self.config).model_dump()
        if self.ended_at < self.started_at:
            raise ValueError("ended_at은 started_at보다 빠를 수 없어요")
        return self


class RunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mode: RunMode
    config: dict[str, Any]
    plan_label: str | None
    started_at: datetime
    ended_at: datetime
    elapsed_s: int
    distance_m: float
    avg_pace_s_per_km: float | None
    counted: bool


class RunDetail(RunSummary):
    segments: list[Segment]
    route: list[RoutePoint]


class RunListOut(BaseModel):
    items: list[RunSummary]
    # 다음 쪽을 달라고 할 때 그대로 돌려보내는 값. 끝이면 null.
    next_cursor: str | None
