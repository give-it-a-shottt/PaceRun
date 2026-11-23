# Pace Run

## 내가 할 일
- 서비스 소개 · 기능별 설계 의도가 내 뜻과 맞는지 확인 → 아래 "이 서비스는", 각 features/F-00X/feature.md
- AI가 대신 정한 결정 확인 → decisions/D-003 ~ D-008
- 내가 정할 질문 확인 → OPEN_QUESTIONS.md
- F-001 리뷰 판정 확인 → features/F-001-앱-뼈대/review/SUMMARY.md

## 한눈에 보기
이 서비스는: 화면을 안 보고 소리 안내로 뛰는 러닝앱이다. 러닝을 꾸준히 못 하는 나 자신이 쓴다. 오늘 뛸 것 하나를 2탭 안에 시작하고(10분 버전은 1탭), 뛰는 중에는 소리로 안내받고, 끝나면 발전이 보이게 한다. (AI 초안 — 사용자 위임, 확인 전. 출처: pacerun-design.md 0장 브리프)

지금 상태: 됨 5 · 일부 2 · 다음 4 · 열린 질문 10개(내가 정할 것 10개)

### 상황별 읽는 곳
| 언제 | 여기만 읽기 | 안 읽어도 되는 것 |
|---|---|---|
| 리뷰가 끝났을 때 | 그 기능의 review/SUMMARY.md — 맨 위 "내가 할 일"부터 "최종 판정"까지 | R1~R4.md, REVIEW_LOG.md, SUMMARY의 "개발자 상세" |
| 지금 어디까지 왔는지 | STATUS.md 맨 위 "내가 할 일"과 개수 한 줄 | 기능별 표는 궁금할 때만 |
| 기능을 시작할 때 | 그 기능의 feature.md 맨 위 "내가 할 일" | — |
| 결정할 게 쌓였을 때 | OPEN_QUESTIONS.md에서 "누가 정해야 하나 = 사용자"인 줄만 | "AI 확인" 질문 |
| 면접 전 | START_HERE.md → 기능별 feature.md의 "면접 예상 질문" | _system/ |
| 같은 문제로 또 막혔을 때 | troubleshooting/INDEX.md | — |

### 표시 범례
| 무엇에 붙나 | 표시 | 뜻 |
|---|---|---|
| 문서·리뷰 전체 상태 | [통과] | 지적이 없거나 [제안]만 있음 |
| | [보완] | [주의] 지적이 있음 |
| | [막힘] | [위험] 지적이 있음. 고치기 전엔 STATUS가 [됨]이 될 수 없음 |
| 지적 하나의 등급 | [위험] | 그대로 두면 잘못 동작하거나 보안 문제가 생김 |
| | [주의] | 지금은 돌아가지만 고치는 게 좋음 |
| | [제안] | 해도 되고 안 해도 됨 |
| 지적의 확신 | [확실] | 해당 코드를 직접 읽고 확인함 |
| | [추정] | 일부만 보고 판단함, 확인이 더 필요함 |
| 2차 이상 리뷰 | [신규] | 이번 회차에 새로 생긴 지적 |
| 기능 진행(STATUS) | [됨] / [일부] / [다음] | 확인까지 끝남 / 진행 중이거나 확인 방법 없음 / 시작 전 |
| 질문(OPEN_QUESTIONS) | [열림] / [닫힘] | 아직 답 없음 / 답이 다른 문서로 옮겨짐 |

이 프로젝트에서 추가로 쓰는 표시: (AI 초안 — 사용자 위임, 확인 전) · (AI 위임 판정) · (AI 위임 결정). 내가 확인하면 (사용자 확인)으로 바꾼다. 이유는 _system/rules.md "위임 규칙".

### 폴더 역할
| 폴더·파일 | 답하는 질문 |
|---|---|
| STATUS.md | 지금 어디까지 왔고, 어떻게 확인했나 |
| OPEN_QUESTIONS.md | 아직 결정 못 한 게 뭔가 |
| overview | 지금 어떻게 생겼나 |
| decisions | 왜 이렇게 했나 |
| features | 무엇을 만들었고, 리뷰 결과는 어땠나 |
| troubleshooting | 뭐가 막혔고 어떻게 풀었나 |
| _system | 규칙·용어·리뷰어 기준 (참고용) |

## 개발자 상세

기술 스택
- 앱: React Native · Expo SDK 58(개발 빌드) · expo-router · TypeScript · expo-sqlite
- 웹: Vite · React · TypeScript · TanStack Query · react-router · Recharts · Leaflet
- 서버: FastAPI · SQLAlchemy 2 · Alembic · Postgres 16 · JWT

실행 방법 (비밀값은 각 폴더의 `.env.example`에 이름만 있음)
- DB: `docker compose up -d`
- 서버: `cd server` → `uv sync` → `uv run alembic upgrade head` → `uv run uvicorn app.main:app --reload`
- 웹: `cd web` → `npm install` → `npm run dev`
- 앱: `cd app` → `npm install` → `npx expo run:android` (JAVA_HOME은 Android Studio의 jbr 폴더)
- 테스트: 서버 `uv run pytest` · 앱 `npm test` · 웹 `npm test`

주요 결정
- D-001 폰 앱은 Expo 개발 빌드, 워치 앱 없음, 웹은 React로 따로
- D-002 서버는 FastAPI + JWT
- D-003 폴더 3개를 서로 독립으로
- D-004 기록은 폰에 먼저 저장
- D-005 소리 안내 타이밍은 "지금 시각으로 계산"
- D-006 액세스 토큰 + 리프레시 토큰
- D-007 러닝 번호는 폰에서 만들고, 경로는 한 칸에 통째로
- D-008 앱 지도는 경로 선만
- D-009 러닝 중 기기 기능은 Expo 모듈만으로

최종 수정: 2026-11-22
