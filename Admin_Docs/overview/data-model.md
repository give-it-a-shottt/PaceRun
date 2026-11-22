# 데이터 모델

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 폰에는 러닝 · 위치 점 · 구간 · 주간 계획 · 설정을 저장한다. 서버에는 회원 · 로그인 연장용 토큰 · 러닝을 저장한다. 러닝 번호는 폰에서 만들어 서버에서도 같은 번호를 쓴다. 💡 비유: 택배 송장 번호를 보내는 사람이 먼저 붙이면, 같은 상자를 두 번 접수해도 한 건으로 처리된다.
왜: 인터넷이 끊겼다 이어져도 같은 기록이 두 번 올라가지 않게 하려고(D-007).

## 개발자 상세

### 폰 (SQLite, `app/src/db/schema.ts`)

| 테이블 | 칸 | 설명 |
|---|---|---|
| runs | id TEXT PK(UUID) · mode · config_json · plan_label · started_at · ended_at · status · elapsed_ms · distance_m · avg_pace_s_per_km · counted · sync_state · updated_at | 러닝 1건. status = active / paused / finished. counted = 10분 인정 여부. sync_state = local / synced |
| run_points | id PK · run_id FK · t · lat · lng · accuracy · elapsed_ms | 위치 점. 약 1초마다 1줄 |
| run_segments | run_id FK · idx · kind · started_elapsed_ms · duration_ms · distance_m (PK run_id+idx) | 구간 기록. kind = run / walk(인터벌) 또는 km(1km 구간). 인터벌을 모두 마친 뒤 더 뛰면 그 뒤는 km 구간으로 이어진다(idx는 이어서 증가). 타이머가 늦어 건너뛴 인터벌 구간은 거리 0으로 남긴다 |
| plan_items | weekday PK(0=월 … 6=일) · mode · config_json · label | 매주 반복되는 계획 1개. 요일당 운동 1개 |
| settings | key PK · value(JSON) | 주 목표, 알림 시간, 음성 안내, 기본 케이던스, 러닝 화면 테마, 온보딩 완료, 마지막 설정, 마지막 동기화 |
| active_run | id PK(항상 1) · state_json · saved_at | 진행 중인 러닝의 계산 상태 한 벌. 러닝 중 약 1초마다 덮어쓰고 끝나면 지운다. 앱이 꺼졌다 켜졌을 때 복구에 쓴다(스키마 2단계) |

- 인덱스: runs(started_at 내림차순) — 기록 목록, runs(sync_state) — 올릴 것 찾기, run_points(run_id, id) — 러닝 한 건의 경로를 순서대로 읽기.
- 시간은 모두 epoch 밀리초(INTEGER). 거리는 미터, 페이스는 km당 초.
- mode = free / interval / cadence / pacemaker. config_json은 모드별 목표값이다(`app/src/domain/types.ts`의 `RunConfig`).

| mode | config_json의 칸 | 범위 |
|---|---|---|
| free | targetDurationSec (초, 제한 없으면 null) | 양수 |
| interval | runSec · walkSec (초) · repeats (반복 수) | 양수 · repeats 1~99 |
| cadence | spm (분당 걸음 수) · durationSec (초) | spm 120~220(소리 파일은 150~190, 5 단위) |
| pacemaker | targetPaceSecPerKm (km당 초) · distanceM (미터) | 양수 |

- 위 범위는 저장된 값을 읽을 때 받아 주는 넓은 범위다(`domain/settings.ts`). 화면에서 고를 수 있는 범위는 더 좁다(`domain/runConfig.ts`의 CONFIG_LIMITS, Q-004).
- 서버 API에서는 같은 값을 snake_case로 주고받는다(예: `runSec` ↔ `run_sec`, api-list.md "러닝").
- 로그인 토큰은 SQLite가 아니라 expo-secure-store에 둔다.

settings 테이블의 키 (`app/src/domain/types.ts`의 `Settings`, 값은 JSON 문자열)

| 키 | 값 | 기본값 |
|---|---|---|
| weeklyGoal | 정수 2~5 | 3 |
| reminderTime | "HH:mm" 또는 null(끔) | null |
| voiceEnabled | true / false | true |
| voiceIntervalKm | 정수 1~10 (자유 모드에서 몇 km마다 말할지) | 1 |
| defaultCadenceSpm | 정수 120~220 | 170 |
| runTheme | "auto"(OS 설정 따름) / "light"(항상 밝게) | "auto" |
| onboardingDone | true / false | false |
| lastRunConfig | 모드별 목표값 객체 또는 null | null |
| lastSyncAt | epoch 밀리초 또는 null | null |

- 읽을 때 타입 · 범위가 틀린 값과 모르는 키는 버리고 기본값을 쓴다(`app/src/domain/settings.ts`).

### 서버 (Postgres, `server/app/models/`)

| 테이블 | 칸 | 제약 |
|---|---|---|
| users | id UUID PK · email(254자) · password_hash · weekly_goal · created_at | email UNIQUE(소문자로 저장), weekly_goal 2~5(기본 3) |
| refresh_tokens | id UUID PK · user_id FK · token_hash(SHA-256, 64자) · expires_at · revoked_at · created_at | token_hash UNIQUE, user_id 인덱스(ix_refresh_tokens_user_id), user 삭제 시 함께 삭제. revoked_at은 교체된 시각(null이면 쓸 수 있음). 만료된 줄은 토큰을 새로 줄 때 지운다. 교체된 줄은 새어 나간 토큰을 알아채는 근거라 만료될 때까지 남긴다. 로그아웃은 줄을 지운다 |
| runs | id UUID PK(폰이 만든 번호) · user_id FK · mode · config JSONB · plan_label · started_at · ended_at · elapsed_s · distance_m · avg_pace_s_per_km · counted · segments JSONB · route JSONB · created_at · updated_at | 인덱스 ix_runs_user_started(user_id, started_at), user 삭제 시 함께 삭제. CHECK: mode 4가지, elapsed_s ≥ 0, distance_m ≥ 0, ended_at ≥ started_at. counted는 서버가 elapsed_s ≥ 600으로 정한다 |

- route = `[[lat, lng, elapsed_s], …]`, segments = `[{idx, kind, started_elapsed_s, duration_s, distance_m}, …]`. 따로 테이블로 나누지 않고 한 칸에 둔다(D-007).
- config(JSONB)는 모드별 목표값이고 칸 이름은 snake_case다(api-list.md "러닝"의 config 표).
- 서버 시간은 timestamptz(UTC). 주 계산(월요일 0시 시작)은 요청의 시간대(tz)로 한다.

### 폰 ↔ 서버 이름 대응 (앱이 올리고 내려받을 때 이 표대로 바꾼다)

| 폰 (SQLite) | 서버 · API | 바꾸는 방법 |
|---|---|---|
| runs.id | `{id}` (주소) | 그대로 |
| mode | mode | 그대로 |
| config_json | config | 칸 이름을 snake_case로(아래 표). 폰의 config_json 안에 든 `mode` 칸은 **빼고** 올린다(서버는 바깥의 mode로 모양을 정하고, 모르는 칸이 있으면 422다). 내려받을 때는 바깥의 mode를 다시 넣는다 |
| plan_label | plan_label | 그대로(null 가능) |
| started_at (밀리초) | started_at | ISO 8601(UTC, `Z`) |
| ended_at (밀리초) | ended_at | ISO 8601. 폰에서는 끝나기 전까지 null이지만, 끝난 러닝만 올리므로 항상 있다 |
| elapsed_ms | elapsed_s | 1000으로 나눠 **내림**. 반올림하면 599.5초가 600초가 되어 폰과 서버의 10분 인정이 어긋난다 |
| distance_m | distance_m | 그대로 |
| avg_pace_s_per_km | avg_pace_s_per_km | 그대로(null 가능) |
| counted | (올리지 않음) | 서버가 elapsed_s ≥ 600으로 정한다. 내려받을 때는 응답의 counted를 쓴다 |
| status · sync_state · updated_at | (올리지 않음) | 폰에서만 쓴다. 끝난(finished) 러닝만 올린다 |
| run_points 여러 줄 (lat, lng, elapsed_ms) | route `[[lat, lng, elapsed_s], …]` | elapsed_ms ÷ 1000(소수 그대로). t · accuracy는 올리지 않는다 |
| run_segments 여러 줄 (idx, kind, started_elapsed_ms, duration_ms, distance_m) | segments `[{idx, kind, started_elapsed_s, duration_s, distance_m}, …]` | 시간 두 칸을 1000으로 나눠 반올림 |

config 칸 이름

| mode | 폰 (camelCase) | 서버 (snake_case) |
|---|---|---|
| free | targetDurationSec | target_duration_sec |
| interval | runSec · walkSec · repeats | run_sec · walk_sec · repeats |
| cadence | spm · durationSec | spm · duration_sec |
| pacemaker | targetPaceSecPerKm · distanceM | target_pace_s_per_km · distance_m |

- 서버가 받는 값의 범위는 api-list.md "러닝"의 표에 있다. 폰에서 고를 수 있는 범위(`app/src/domain/runConfig.ts`)는 모두 그 안이다.
- 폰의 값이 서버 상한을 넘는 드문 경우(그대로 올리면 영영 422다) — Q-006 임시 처리, 앱이 올릴 때 맞춘다(F-010):

| 넘을 수 있는 값 | 언제 | 올릴 때 |
|---|---|---|
| 경로 20000점 | 약 5시간 반 넘게 뛴 러닝 | 점을 고르게 솎아 20000점 이하로(처음 · 끝 점은 남긴다) |
| 평균 페이스 86400초/km | 아주 짧은 거리를 오래 걸은 기록 | null로 올린다 |
| plan_label 50자 | 지금은 긴 라벨을 만드는 화면이 없다 | 50자로 자른다 |
| config의 실수 · 범위 밖 값 | 저장돼 있던 옛 값 | 정수로 반올림하고 서버 범위 안으로 맞춘다 |
| 경과 시간 24시간 · 거리 300km | 끄지 않고 둔 러닝 | 올리지 않는다(폰에만 남기고 "올리지 못한 기록"으로 표시) |

최종 수정: 2026-11-23 · 관련: D-004, D-006, D-007
