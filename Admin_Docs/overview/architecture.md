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
- `app/src/services/` — 기기 기능을 감싼 것: 위치 기록(runLocation · gps · permissions), 음성 · 메트로놈(voice · metronome), 알림(runNotification), 진동(haptics), 홈 값 읽기(homeData), 기록 화면 값 읽기(recordsData), 주간 계획 읽기 · 저장(planData), 온보딩 끝내기(onboarding), 매일 알림 예약(reminder), 서버와 맞추기(apiClient → session → sync · account: 요청 한 건 → 토큰 → 올리기 · 내려받기). `runController`가 러닝 한 번의 진행(위치 · 타이머 → 계산 → 화면 상태 · DB · 음성)을 맡는다.
- `app/src/db/` — expo-sqlite 스키마와 쿼리. 쓰기는 모두 `withWriteTransaction`으로 한 줄씩 한다.
- `app/src/state/` — 화면 여러 곳이 함께 보는 메모리 상태(zustand): 설정(settingsStore), 토스트(toastStore), 진행 중인 러닝(runStore), 러닝 화면 테마(useRunScheme), 로그인 · 동기화 상태(authStore). DB를 불러 값을 채운다.
- `app/plugins/` — 네이티브 빌드 설정을 덧붙이는 설정 플러그인(`android/`는 만들어지는 산출물이라 직접 고치지 않는다).
- `app/src/theme/` · `app/src/components/` — 디자인 토큰과 공용 컴포넌트(여러 화면이 함께 쓰는 훅도 여기: 예 `useRefreshOnFocus`). 한 기능에서만 쓰는 화면 부품은 `components/run/`처럼 기능 폴더에 둔다.
- `server/app/routers/` → `server/app/services/` → `server/app/models/` — 의존은 이 방향으로만 흐른다. 라우터에는 요청 · 응답 변환만 둔다.
- `web/src/pages/` · `web/src/api/` · `web/src/components/`.

의존 방향 규칙
- 앱: 화면 → 서비스 → state → db → domain. domain은 아무것도 의존하지 않는다(React · Expo · DB를 import하지 않음).
  - 서비스는 state를 쓴다(예: `runController`가 계산 결과를 `runStore`에 넣고, 설정 · 토스트 store를 읽고 쓴다). state는 서비스를 부르지 않는다. 그래서 서로를 부르는 고리가 없다.
  - domain 안에서도 한 방향이다: `runEngine` → `modeCues` → `interval` · `pace` · `format`. `modeCues`는 `runEngine`의 타입만 가져온다.
- 서버: 라우터 → 서비스 → 모델. 서비스는 FastAPI의 Request · Response를 모른다.
- 세 폴더는 서로의 코드를 import하지 않는다(D-003). 계약은 overview/api-list.md다.

러닝 중 흐름 (D-005)
1. 위치 서비스가 화면이 꺼져도 위치를 받는다(포그라운드 서비스).
2. 위치가 올 때와 1초 타이머가 울릴 때, "지금 시각"을 넣어 domain의 계산 함수를 부른다.
3. 계산 결과(경과 시간 · 거리 · 지금 구간 · 내보낼 안내)를 화면 상태와 SQLite에 반영하고, 안내는 음성으로 말한다.
4. 화면은 계산 상태와 "지금 시각"만 받아 `domain/runView`로 글자를 만들어 그린다. 화면에 계산 로직을 두지 않는다.

최종 수정: 2026-11-23 · 관련: D-001, D-003, D-004, D-005
