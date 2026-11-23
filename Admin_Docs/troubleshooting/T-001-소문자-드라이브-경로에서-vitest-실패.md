# T-001 소문자 드라이브 경로에서 vitest가 실패한다

## 한눈에 보기 (코드 몰라도 OK)
상태: [통과]
무슨 문제였나: 테스트 코드는 멀쩡한데, `c:\project\...`처럼 드라이브 문자가 소문자인 폴더에서 테스트를 돌리면 전부 실패했다.
어떻게 해결했나: 테스트를 띄우기 전에 드라이브 문자를 대문자(`C:\`)로 바꿔 주는 작은 실행 스크립트를 두고, `npm test`가 그 스크립트를 쓰게 했다.

## 개발자 상세
- 증상: `npx vitest run` → 모든 테스트 파일이 `TypeError: Cannot read properties of undefined (reading 'config')`로 실패. 테스트는 0개 실행.
- 원인: 윈도우는 `c:\`와 `C:\`를 같은 폴더로 보지만 Node는 경로 문자열로 모듈을 구분한다. 드라이브 문자가 소문자인 경로에서 실행하면 vitest 내부 모듈이 두 벌 읽혀, 테스트 파일이 "실행 중인 vitest"가 아닌 다른 사본의 `describe`를 부른다. VS Code가 폴더를 `c:\project\PaceRun`으로 열기 때문에 VS Code 터미널에서 그대로 재현된다.
- 확인: 같은 명령을 `C:\project\PaceRun\app`에서 실행하면 12개 모두 통과.
- 해결: `app/scripts/vitest.mjs`가 현재 폴더의 드라이브 문자를 대문자로 바꿔 vitest를 다시 띄운다. `package.json`의 `test` 스크립트가 이 파일을 쓴다.
- 재발 방지: 앱 테스트는 `npx vitest`를 직접 부르지 말고 `npm test`로 돌린다. 웹(`web/`)에도 같은 스크립트(`web/scripts/vitest.mjs`)를 두었다(F-011 — 처음에 빠뜨려 같은 오류를 한 번 더 봤다).
- 함께 고친 것: 설정 파일을 `vitest.config.mts`로 두었다(.ts면 CommonJS로 읽혀 경고가 난다).

최종 수정: 2026-11-22 · 관련: F-001
