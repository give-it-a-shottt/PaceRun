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
| run_segments | run_id FK · idx · kind · started_elapsed_ms · duration_ms · distance_m (PK run_id+idx) | 구간 기록. kind = run / walk(인터벌) 또는 km(1km 구간) |
| plan_items | weekday PK(0=월 … 6=일) · mode · config_json · label | 매주 반복되는 계획 1개. 요일당 운동 1개 |
| settings | key PK · value(JSON) | 주 목표, 알림 시간, 음성 안내, 기본 케이던스, 러닝 화면 테마, 온보딩 완료, 마지막 설정, 마지막 동기화 |

- 시간은 모두 epoch 밀리초(INTEGER). 거리는 미터, 페이스는 km당 초.
- mode = free / interval / cadence / pacemaker. config_json은 모드별 목표값(예: 인터벌 runSec · walkSec · repeats).
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
| refresh_tokens | id UUID PK · user_id FK · token_hash(SHA-256, 64자) · expires_at · revoked_at · created_at | token_hash UNIQUE, user_id 인덱스(ix_refresh_tokens_user_id), user 삭제 시 함께 삭제. revoked_at은 교체된 시각(null이면 쓸 수 있음). 만료됐거나 교체된 지 하루 넘은 줄은 토큰을 새로 줄 때 지운다 |
| runs | id UUID PK(폰이 만든 번호) · user_id FK · mode · config JSONB · plan_label · started_at · ended_at · elapsed_s · distance_m · avg_pace_s_per_km · counted · segments JSONB · route JSONB · created_at · updated_at | 인덱스 (user_id, started_at DESC) |

- route = `[[lat, lng, elapsed_s], …]`, segments = `[{idx, kind, started_elapsed_s, duration_s, distance_m}, …]`. 따로 테이블로 나누지 않고 한 칸에 둔다(D-007).
- 서버 시간은 timestamptz(UTC). 주 계산(월요일 0시 시작)은 요청의 시간대(tz)로 한다.

### 폰 ↔ 서버 이름 대응

| 폰 | 서버 · API |
|---|---|
| elapsed_ms | elapsed_s (초, 정수로 반올림) |
| run_points 여러 줄 | route 배열 |
| run_segments 여러 줄 | segments 배열 |
| started_at(밀리초) | started_at(ISO 8601 문자열) |

최종 수정: 2026-11-22 · 관련: D-004, D-006, D-007
