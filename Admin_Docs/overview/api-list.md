# API 목록

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 앱과 웹이 서버에 보내는 요청은 세 묶음이다. ① 가입 · 로그인 ② 러닝 올리기 · 받기 ③ 대시보드 통계. 💡 비유: 은행 창구 번호표 — 어떤 창구(주소)에 어떤 서류(요청)를 내면 무엇(응답)을 돌려받는지 적은 표다.
왜: 앱 · 웹 · 서버가 따로 만들어져도 같은 약속을 보게 하려고.

## 개발자 상세

공통
- 주소 앞부분: `/api/v1`
- 인증: `Authorization: Bearer <액세스 토큰>`. "인증" 칸이 O인 요청에 필요하다.
- 에러 형식: `{"detail": {"code": "대문자_코드", "message": "사용자에게 보여 줄 말"}}`. 입력 오류(422)는 `fields: [{field, message}]`가 더 붙는다.
- 공통 에러: 401 `UNAUTHORIZED`(토큰 없음 · 만료 · 틀림), 403 `FORBIDDEN`, 404 `NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, 411 `LENGTH_REQUIRED`, 413 `PAYLOAD_TOO_LARGE`(본문 2MB 초과), 422 `VALIDATION`, 500 `INTERNAL`. 그 밖의 HTTP 오류는 `HTTP_ERROR`.
- `/api/v1` 밖: `GET /health` → 200 `{"status": "ok"}` (서버가 떠 있는지 확인용, 인증 없음)

### 인증

| 메서드 · 경로 | 인증 | 요청 | 성공 응답 | 에러 |
|---|---|---|---|---|
| POST /auth/signup | X | `{email, password}` (비밀번호 8~72자) | 201 `AuthOut` | 409 `EMAIL_TAKEN` |
| POST /auth/login | X | `{email, password}` | 200 `AuthOut` | 401 `INVALID_CREDENTIALS`, 422(형식 오류 · 비밀번호 73자 이상) |
| POST /auth/refresh | X | 앱: `{refresh_token}` / 웹: 쿠키 + `X-Refresh-Mode: cookie` | 200 `TokenOut` | 401 `INVALID_REFRESH` |
| POST /auth/logout | X | `{refresh_token}` 또는 쿠키 | 204 | — |
| GET /me | O | — | 200 `UserOut` | |
| PATCH /me | O | `{weekly_goal}` (2~5) | 200 `UserOut` | 422(범위 밖) |

- `UserOut` = `{id, email, weekly_goal}`
- `TokenOut` = `{access_token, refresh_token, token_type: "bearer", expires_in}`. `expires_in`은 액세스 토큰의 유효 시간(초). 쿠키 방식에서는 `refresh_token`이 null이다.
- `AuthOut` = `TokenOut` + `{user: UserOut}`
- 리프레시 토큰을 받는 방식은 두 가지다(D-006).
  - 앱(기본): 응답 본문의 `refresh_token`으로 받고, 갱신 · 로그아웃 때 본문에 넣어 보낸다.
  - 웹(쿠키 방식): signup · login · refresh 요청에 `X-Refresh-Mode: cookie` 헤더를 붙인다. 그러면 본문의 `refresh_token`은 null이고 httpOnly 쿠키 `pr_refresh`(경로 `/api/v1/auth`, SameSite=Lax)로만 온다. 요청은 쿠키를 싣도록 보낸다(fetch `credentials: "include"`). logout은 쿠키의 토큰을 폐기하고 쿠키를 지운다.
- 한 번 쓴 리프레시 토큰은 다시 쓸 수 없다(401 `INVALID_REFRESH`).
  - 교체된 지 10초가 넘은 토큰이 다시 오면 새어 나간 것으로 보고 그 회원의 토큰을 모두 폐기한다(모든 기기에서 다시 로그인). 교체된 기록은 그 토큰이 만료될 때(30일)까지 남으므로 그동안은 언제 와도 알아챈다.
  - 교체된 지 10초 안이면 같은 사용자의 동시 요청(브라우저 탭 2개 등)으로 보고 401만 준다. 다른 토큰은 그대로다.
  - 로그아웃한 토큰은 지워지므로 다시 와도 401만 준다. 이미 교체된 토큰으로 로그아웃하면 기록은 남는다.
  - 쿠키 방식에서 갱신이 401이면 서버가 `pr_refresh` 쿠키도 지운다. 단, 동시 요청으로 본 경우(10초 안)는 지우지 않는다 — 다른 탭이 방금 받은 새 쿠키일 수 있다.
- `pr_refresh` 쿠키의 Secure 속성은 환경변수 `COOKIE_SECURE`로 켠다(운영 HTTPS에서는 true).

### 러닝

| 메서드 · 경로 | 인증 | 요청 | 성공 응답 | 에러 |
|---|---|---|---|---|
| PUT /runs/{id} | O | `RunIn` | 201(새로 저장) 또는 200(이미 있어 덮어씀) `RunSummary` | 409 `RUN_ID_CONFLICT`(다른 회원의 번호), 413 `PAYLOAD_TOO_LARGE`, 422 |
| GET /runs | O | 쿼리 `limit`(1~100, 기본 20), `cursor` | 200 `{items: RunSummary[], next_cursor}` | 422(limit · cursor) |
| GET /runs/{id} | O | — | 200 `RunDetail` | 404 `RUN_NOT_FOUND`(없거나 남의 것), 422(UUID 아님) |

`RunIn` (모르는 칸이 있으면 422)

| 칸 | 타입 | 꼭 필요 | 범위 |
|---|---|---|---|
| mode | "free" · "interval" · "cadence" · "pacemaker" | O | |
| config | 객체 (아래 표) | O | 모드에 맞는 모양 |
| plan_label | 문자열 또는 null | X(없으면 null) | 50자까지 |
| started_at · ended_at | 시간대가 붙은 ISO 8601 | O | ended_at ≥ started_at |
| elapsed_s | 정수 | O | 0~86400(24시간), `ended_at − started_at + 5초`를 넘으면 422 |
| distance_m | 실수 | O | 0~300000 |
| avg_pace_s_per_km | 실수 또는 null | X(없으면 null) | 0 초과 ~ 86400 |
| segments | `{idx, kind, started_elapsed_s, duration_s, distance_m}` 배열 | X(없으면 빈 배열) | 1000개까지. kind ∈ run · walk · km, idx ≥ 0, 시간 0~86400, 거리 0~300000 |
| route | `[lat, lng, elapsed_s]` 배열 | X(없으면 빈 배열) | 20000점까지. lat −90~90, lng −180~180, elapsed_s 0~86400 |

- `counted`는 받지 않는다(보내면 422). 서버가 `elapsed_s ≥ 600`(10분)으로 정한다.
- NaN · 무한대는 받지 않는다.
- 요청 본문은 2MB까지다. 넘으면 본문을 읽기 전에 413을 준다(로그인 여부와 관계없이). 크기를 밝히지 않은 조각 전송은 411 `LENGTH_REQUIRED`.

config (폰 DB의 camelCase 칸을 snake_case로 바꾼 것. 틀리면 422이고 문구에 `config.칸이름`이 들어간다)

| mode | config | 범위 |
|---|---|---|
| free | `{target_duration_sec}` | 1~86400 또는 null(제한 없음) |
| interval | `{run_sec, walk_sec, repeats}` | run_sec · walk_sec 1~3600, repeats 1~99 |
| cadence | `{spm, duration_sec}` | spm 120~220, duration_sec 1~86400 |
| pacemaker | `{target_pace_s_per_km, distance_m}` | 1~86400, 1~300000 |

응답
- `RunSummary` = `{id, mode, config, plan_label, started_at, ended_at, elapsed_s, distance_m, avg_pace_s_per_km, counted}`. plan_label · avg_pace_s_per_km는 null일 수 있다.
- `RunDetail` = `RunSummary` + `{segments, route}`
- 목록은 started_at이 늦은 것부터, 같으면 id가 큰 것부터다. `next_cursor`는 다음 쪽을 달라고 할 때 그대로 돌려보내는 값이고, null이면 끝이다.
- 다른 회원이 쓰는 번호로 올리면 409이고 원래 기록은 바뀌지 않는다.

### 통계 (웹 대시보드)

| 메서드 · 경로 | 인증 | 요청 | 성공 응답 |
|---|---|---|---|
| GET /stats | O | 쿼리 `period`(month · year, 기본 month), `anchor`(YYYY-MM-DD, 기본 오늘, 2000-01-01 ~ 2100-12-31), `tz`(IANA 시간대 이름, 기본 Asia/Seoul) | 200 `StatsOut` |

- `StatsOut` = `{period, start, end, buckets: [{label, start, distance_m, count, elapsed_s}], totals: {distance_m, count, elapsed_s}, goal_weeks: {achieved, total}, weekly_goal}`
- month는 날짜별(기록 없는 날도 0으로 채움, label = 날짜 숫자), year는 월별 12칸(label = "1월"…)이다. `start`는 기간 첫날, `end`는 기간 끝 다음 날이다.
- distance_m · elapsed_s는 모든 러닝의 합이고, count는 10분 인정된 러닝 수다.
- 하루와 한 주의 경계는 `tz`의 시각으로 나눈다. period · anchor · tz가 틀리거나 anchor가 범위 밖이면 422 `VALIDATION`.
- goal_weeks.total은 기간과 겹치는 주(월요일 시작) 가운데 이미 시작한 주의 수, achieved는 그중 인정 횟수가 주 목표(지금의 `weekly_goal`) 이상인 주의 수다. 주 목표를 바꾸면 지난 주들의 달성 여부도 새 목표로 다시 센다(Q-005). 기간 밖으로 걸친 주는 그 주 전체(월~일)의 횟수로 본다.

최종 수정: 2026-11-22 · 관련: F-008, F-009, D-006, D-007
