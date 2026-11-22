"""러닝 요청 · 응답 모양(overview/api-list.md "러닝")."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError, model_validator

RunMode = Literal["free", "interval", "cadence", "pacemaker"]
SegmentKind = Literal["run", "walk", "km"]

# 한 번의 요청이 서버를 무겁게 만들지 못하게 하는 상한(overview/api-list.md "러닝"의 상한 표와 같아야 한다)
SECONDS_PER_HOUR = 60 * 60
MAX_ELAPSED_S = 24 * SECONDS_PER_HOUR
MAX_DISTANCE_M = 300_000
MAX_ROUTE_POINTS = 20_000
MAX_SEGMENTS = 1_000
MAX_PLAN_LABEL = 50
# 페이스(km당 초)의 상한. 아주 천천히 걸은 기록도 받아야 해서 넉넉하게 둔다
MAX_PACE_S_PER_KM = MAX_ELAPSED_S
# 목표값(config)의 상한. 앱이 고를 수 있는 범위(app/src/domain/runConfig.ts)보다 넓다
MAX_INTERVAL_STEP_S = SECONDS_PER_HOUR
MAX_INTERVAL_REPEATS = 99
MIN_CADENCE_SPM = 120
MAX_CADENCE_SPM = 220
# 끝 시각 − 시작 시각보다 경과 시간이 이만큼 넘게 길면 틀린 값으로 본다(시계 오차 여유)
ELAPSED_TOLERANCE_S = 5


class _Strict(BaseModel):
    # extra="forbid": 모르는 칸이 오면 조용히 버리지 않고 422로 알려 준다(앱과 서버의 약속이 어긋난 것을 일찍 발견)
    # allow_inf_nan=False: NaN · 무한대는 받지 않는다(합계가 NaN이 되어 통계가 망가진다)
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class FreeConfig(_Strict):
    target_duration_sec: int | None = Field(default=None, gt=0, le=MAX_ELAPSED_S)


class IntervalConfig(_Strict):
    run_sec: int = Field(gt=0, le=MAX_INTERVAL_STEP_S)
    walk_sec: int = Field(gt=0, le=MAX_INTERVAL_STEP_S)
    repeats: int = Field(ge=1, le=MAX_INTERVAL_REPEATS)


class CadenceConfig(_Strict):
    spm: int = Field(ge=MIN_CADENCE_SPM, le=MAX_CADENCE_SPM)
    duration_sec: int = Field(gt=0, le=MAX_ELAPSED_S)


class PacemakerConfig(_Strict):
    target_pace_s_per_km: int = Field(gt=0, le=MAX_PACE_S_PER_KM)
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
    plan_label: str | None = Field(default=None, max_length=MAX_PLAN_LABEL)
    # 시간대가 붙은 시각만 받는다(붙지 않은 시각은 어느 나라 시각인지 알 수 없다)
    started_at: AwareDatetime
    ended_at: AwareDatetime
    elapsed_s: int = Field(ge=0, le=MAX_ELAPSED_S)
    distance_m: float = Field(ge=0, le=MAX_DISTANCE_M)
    avg_pace_s_per_km: float | None = Field(default=None, gt=0, le=MAX_PACE_S_PER_KM)
    segments: list[Segment] = Field(default_factory=list, max_length=MAX_SEGMENTS)
    route: list[RoutePoint] = Field(default_factory=list, max_length=MAX_ROUTE_POINTS)

    @model_validator(mode="after")
    def _check(self) -> "RunIn":
        try:
            self.config = CONFIG_MODELS[self.mode].model_validate(self.config).model_dump()
        except ValidationError as error:
            # 어느 칸이 틀렸는지 문구에 담는다(모드에 따라 모양이 달라 칸 단위 위치를 줄 수 없다)
            details = "; ".join(
                f"config.{'.'.join(str(part) for part in item['loc'])}: {item['msg']}" for item in error.errors()
            )
            raise ValueError(details) from error
        if self.ended_at < self.started_at:
            raise ValueError("ended_at은 started_at보다 빠를 수 없어요")
        # 경과 시간은 일시정지를 뺀 값이라, 끝 시각 − 시작 시각보다 길 수 없다.
        # 이 검사가 없으면 1분 뛴 기록에 elapsed_s만 크게 보내 "10분 인정"을 받을 수 있다.
        wall_s = (self.ended_at - self.started_at).total_seconds()
        if self.elapsed_s > wall_s + ELAPSED_TOLERANCE_S:
            raise ValueError("elapsed_s는 ended_at − started_at보다 길 수 없어요")
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
