# 화면 목록과 라우팅

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 앱은 아래쪽 탭 4개(홈 · 계획 · 기록 · 내 정보)와, 탭 없이 화면 전체를 쓰는 러닝 화면으로 나뉜다. 첫 실행 때만 안내 3단계를 거친다. 웹은 로그인 · 대시보드 · 러닝 상세 3개다. 💡 비유: 건물 안내도 — 어느 문(주소)으로 들어가면 어느 방(화면 파일)이 나오는지 적은 표다.
왜: 화면 ID(기획) · 주소 · 파일을 한 줄로 이어 찾기 쉽게 하려고.

## 개발자 상세

화면 ID와 구성 요소의 기준은 pacerun-design.md 0-4(IA) · 0-5(유저플로우)다. 여기에는 라우팅만 적는다.

### 앱 (expo-router, `app/src/app/`)

| 화면 ID | 라우트 | 파일 | 형태 |
|---|---|---|---|
| — | `/` | index.tsx | 첫 실행이면 온보딩으로, 아니면 홈으로 보냄 |
| ONB_01_001 | `/onboarding/permissions` | onboarding/permissions.tsx | 페이지 |
| ONB_01_002 | `/onboarding/battery` | onboarding/battery.tsx | 페이지 |
| ONB_01_003 | `/onboarding/goal` | onboarding/goal.tsx | 페이지 |
| HOM_01_001 | `/home` | (tabs)/home.tsx | 탭. 상태 4개는 한 파일 안에서 갈림 |
| RUN_01_001 · RUN_02_005 | (라우트 없음) | src/components/run/RunSetupSheet.tsx | 홈 위 바텀시트, 배터리 경고 배너 포함 |
| PLN_01_001 · PLN_01_004 | `/plan` | (tabs)/plan.tsx | 탭. 빈 상태 포함 |
| PLN_01_002 | (라우트 없음) | src/components/plan/WorkoutSheet.tsx | 계획 위 바텀시트 |
| PLN_01_003 | `/plan/templates` | plan/templates.tsx | 페이지 |
| REC_01_001 · REC_01_003 | `/records` | (tabs)/records.tsx | 탭. 빈 상태 포함 |
| REC_01_002 | `/records/[id]` | records/[id].tsx | 페이지 |
| MY_01_001 | `/my` | (tabs)/my.tsx | 탭 |
| MY_01_002 | `/my/sync` | my/sync.tsx | 페이지 |
| MY_01_003 | `/my/login` | my/login.tsx | 페이지 |
| MY_01_004 | `/my/signup` | my/signup.tsx | 페이지 |
| — | `/run/countdown` | run/countdown.tsx | 전체 화면. 3초 카운트다운 뒤 러닝을 시작한다. 파라미터 `config`(JSON) · `planLabel` |
| RUN_01_002 · 003 · RUN_02_006 | `/run/active` | run/active.tsx | 전체 화면(탭 없음). 러닝 중 · 일시정지 · GPS 끊김은 한 화면의 상태 |
| RUN_01_005 | (라우트 없음) | src/components/run/PocketMode.tsx | 주머니 모드. 부품만 있고 아직 연결하지 않았다(Q-003) |
| RUN_01_004 | `/run/summary/[id]` | run/summary/[id].tsx | 페이지(탭 없음) |
| RUN_02_001 | (라우트 없음) | src/components/run/GpsNotice.tsx | 시작 전 설정 시트 위(또는 홈의 버튼 위)에 띄우는 안내 + [그냥 시작하기] |
| RUN_02_002 · 003 · 004 | (라우트 없음) | 알림 창(AlertDialog) | 권한 없음(run/LocationAlert) · 강제 종료 복구(홈) · 10분 전 종료(run/active) |

이동 규칙
- [시작] → 시작 전 설정 시트 → (위치 권한 · GPS 확인) → `/run/countdown` → `/run/active`
- [10분만 뛰기] → (위치 권한 · GPS 확인) → `/run/countdown` → `/run/active`(자유 10분)
- 러닝 화면들은 홈 위에 쌓지 않고 바꿔 넣는다(`router.replace`). 끝나고 홈으로 돌아올 때 홈이 겹쳐 쌓이지 않게 하려는 것.
- 종료 → 10분 전이면 확인 창 → `/run/summary/[id]` → [확인] → `/home`
- 홈이 보일 때마다 끝나지 않은 러닝이 있는지 본다. 방금까지 기록되고 있었으면 `/run/active`로 보내고, 끊겨 있었으면 복구 창(RUN_02_003)을 띄운다.

### 웹 (react-router, `web/src/pages/`)

| 화면 ID | 라우트 | 파일 | 권한 |
|---|---|---|---|
| WEB_01_001 | `/login` | LoginPage.tsx | 누구나 |
| WEB_01_002 | `/` | DashboardPage.tsx | 로그인 회원. 아니면 `/login`으로 |
| WEB_01_003 | `/runs/:id` | RunDetailPage.tsx | 로그인 회원 |

최종 수정: 2026-11-22 · 관련: F-001 ~ F-011
