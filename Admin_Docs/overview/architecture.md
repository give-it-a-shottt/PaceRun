# 전체 구조

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무엇을: 폰 앱이 러닝을 기록해 폰 안에 먼저 저장한다. 계정을 연결하면 서버로 올리고, 웹 대시보드는 서버에 올라간 기록만 보여 준다. 💡 비유: 폰은 수첩, 서버는 서류 보관함, 웹은 보관함을 넓게 펼쳐 보는 책상이다. 수첩만 있어도 뛸 수 있다.
왜: 로그인 없이 바로 뛰고, 인터넷이 없어도 기록이 끊기지 않게 하려고.

## 개발자 상세

```
[폰 앱 app/]                         [서버 server/]              [웹 web/]
화면(src/app) ─ state ─ 서비스        라우터 → 서비스 → DB(모델)    화면 → API 호출(TanStack Query)
        │              │                    ▲                          │
        ▼              ▼                    │ HTTPS · JWT              │
   순수 로직(domain)  SQLite(db) ── 동기화 ──┘◄─────────────────────────┘
```

폴더
- `app/src/app/` — expo-router 라우트 파일(화면). 화면은 서비스와 DB 쿼리를 부르기만 한다. 라우트가 아닌 코드는 이 폴더 밖에 둔다.
- `app/src/domain/` — 순수 TypeScript 로직. React · Expo를 import하지 않는다(단위 테스트 대상).
- `app/src/services/` — 기기 기능을 감싼 것: 위치 기록, 음성 · 메트로놈, 알림, 동기화.
- `app/src/db/` — expo-sqlite 스키마와 쿼리.
- `app/src/state/` — 화면 여러 곳이 함께 보는 메모리 상태(zustand): 설정, 토스트. DB나 서비스를 불러 값을 채운다.
- `app/plugins/` — 네이티브 빌드 설정을 덧붙이는 설정 플러그인(`android/`는 만들어지는 산출물이라 직접 고치지 않는다).
- `app/src/theme/` · `app/src/components/` — 디자인 토큰과 공용 컴포넌트.
- `server/app/routers/` → `server/app/services/` → `server/app/models/` — 의존은 이 방향으로만 흐른다. 라우터에는 요청 · 응답 변환만 둔다.
- `web/src/pages/` · `web/src/api/` · `web/src/components/`.

의존 방향 규칙
- 앱: 화면 → state · 서비스 → db → domain. domain은 아무것도 의존하지 않는다(React · Expo · DB를 import하지 않음).
- 서버: 라우터 → 서비스 → 모델. 서비스는 FastAPI의 Request · Response를 모른다.
- 세 폴더는 서로의 코드를 import하지 않는다(D-003). 계약은 overview/api-list.md다.

러닝 중 흐름 (D-005)
1. 위치 서비스가 화면이 꺼져도 위치를 받는다(포그라운드 서비스).
2. 위치가 올 때와 1초 타이머가 울릴 때, "지금 시각"을 넣어 domain의 계산 함수를 부른다.
3. 계산 결과(경과 시간 · 거리 · 지금 구간 · 내보낼 안내)를 화면 상태와 SQLite에 반영하고, 안내는 음성으로 말한다.

최종 수정: 2026-11-22 · 관련: D-001, D-003, D-004, D-005
