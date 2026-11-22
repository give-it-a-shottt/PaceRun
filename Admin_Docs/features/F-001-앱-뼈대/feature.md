# F-001 앱 뼈대

## 내가 할 일
- 설계 의도가 내 뜻과 맞는지 확인 → 아래 "설계 의도"
- 면접 답 3개 → 아래 "면접 예상 질문"

## 한눈에 보기
상태: [보완] (1차 리뷰 전)
무엇을: 앱을 켜면 하단 탭 4개(홈 · 계획 · 기록 · 내 정보)가 보이는 빈 뼈대. 색 · 글자 규칙, 공용 부품(버튼 · 카드 · 상단 바 · 바텀시트 · 확인 창 · 토스트), 폰 안의 DB까지 깔아 둔다.
왜: 뒤에 만드는 모든 화면이 같은 부품과 같은 DB를 쓰게 하려고.

## 설계 의도 (AI 초안 — 사용자 위임, 확인 전)
출처: pacerun-design.md 0-4 IA, 1~4장, D-001, D-004

- 이 기능이 해결하는 문제: 화면마다 색 · 글자 · 버튼을 따로 만들면 디자인 시스템과 어긋나고, 기록을 폰에 먼저 저장할 곳이 없다.
- 완료 기준(무엇이 되면 끝인지):
  1. 개발 빌드가 에뮬레이터에 설치되고, 앱을 켜면 홈 탭이 보인다.
  2. 하단 탭 4개(홈 · 계획 · 기록 · 내 정보)를 눌러 오갈 수 있다. 각 탭은 아직 자리 표시만 있다.
  3. 색 · 간격 · 글자 크기는 피그마 변수에서 옮긴 토큰으로만 쓴다(Light 기본, Dark는 러닝 화면용).
  4. 앱을 처음 켜면 폰 DB에 테이블 5개(runs · run_points · run_segments · plan_items · settings)가 생긴다.
  5. 설정을 읽고 저장할 수 있고, 저장된 값이 없으면 기본값이 나온다.
- 화면: `/` → `/home`으로 보냄. `(tabs)/home · plan · records · my`(자리 표시). 온보딩 · 러닝 · 하위 화면 라우트는 각 기능(F-002~F-010)에서 추가한다.
- API: 없음
- 데이터: 폰 SQLite 테이블 5개를 만든다(overview/data-model.md).

## 결과 (AI 작성 — 구현 후)
- 바뀐 파일
  - 설정: `app/app.json`(이름 · 패키지 · 권한 · 플러그인), `app/package.json`, `app/vitest.config.mts`, `app/scripts/vitest.mjs`
  - 테마: `app/src/theme/tokens.ts`, `ThemeContext.tsx`
  - 공용 부품: `app/src/components/` AppText · Button · Card · TopBar · DockBar · BottomSheet · AlertDialog · Toast · Screen · ComingSoon
  - DB: `app/src/db/schema.ts`(스키마 · 단계별 변경), `database.ts`(연결 · 단계 적용), `settingsRepo.ts`
  - 로직 · 상태: `app/src/domain/types.ts`, `settings.ts`, `app/src/state/settingsStore.ts`
  - 라우트: `app/src/app/_layout.tsx`, `index.tsx`, `(tabs)/_layout.tsx`, `(tabs)/home · plan · records · my.tsx`
  - 테스트: `app/src/domain/settings.test.ts`, `app/src/db/schema.test.ts`
- 실제 구조
  - 루트 레이아웃이 설정을 DB에서 읽을 때까지 스플래시를 붙잡고, 읽은 뒤 Light 테마로 화면을 그린다.
  - DB 연결은 React 밖에서도 쓸 수 있게 모듈 하나(`getDb`)로 둔다. 스키마 변경은 `PRAGMA user_version`으로 단계를 세어 모자란 단계만 적용한다.
  - 설정은 메모리(zustand)에 한 벌 두고, 바꿀 때마다 DB에 저장한다. 저장에 실패하면 화면 값을 되돌린다.
  - 탭은 expo-router의 JS 탭에 직접 만든 Dock Bar를 끼웠다.
- 설계 의도와 다른 점
  - Dark 색 가운데 피그마 Dark 프레임에 나오지 않는 토큰은 Light 값을 물려받게 했다(러닝 화면에서 쓰지 않는 토큰).
  - 입력 오류 문구 색(statusErrorText)은 피그마 변수에 없어 임시 값을 넣었다.

## 리뷰
- review/SUMMARY.md (아직 없음)

## 열린 질문
없음

## 면접 예상 질문
(1차 리뷰 뒤 작성)

최종 수정: 2026-11-22 · 관련: D-001, D-003, D-004, T-001
