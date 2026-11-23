# Pace Run 웹 대시보드

PC 브라우저에서 러닝 기록을 크게 보는 사이트(Vite · React · TypeScript). 앱에서 연결한 계정으로 로그인한다.

## 실행

```
npm install
npm run dev      # http://localhost:5173
```

- API 서버가 떠 있어야 한다(`server/` — 기본 `http://127.0.0.1:8000`). 개발 서버가 `/api`로 온 요청을 그 주소로 넘겨 준다.
- 서버를 다른 곳에 띄웠으면 `VITE_DEV_API_TARGET=http://주소:포트 npm run dev`.
- 배포해서 API가 다른 주소에 있으면 빌드할 때 `VITE_API_URL`을 준다(그 서버의 `CORS_ORIGINS`에 이 사이트 주소를 넣어야 한다). 로그인 쿠키가 SameSite=Lax라 사이트와 API가 같은 사이트(예: `app.example.com`과 `api.example.com`)여야 새로 고침 뒤에도 로그인이 유지된다.

## 확인

```
npm test         # 계산 · 서버 통신 테스트 (npx vitest를 직접 부르지 않는다 — Admin_Docs/troubleshooting/T-001)
npm run lint
npm run build
```

## 폴더

- `src/domain/` — 화면에 그릴 값을 만드는 순수 함수(대시보드 · 주 목표 · 러닝 목록과 상세 · 로그인 입력 확인)
- `src/api/` — 서버 통신: `client`(요청 한 건) → `session`(로그인 상태 · 토큰) → `runs`(조회)
- `src/app/` — 라우트 지키기 · 조회 설정
- `src/pages/` · `src/components/` · `src/styles/` — 화면

설계와 결정은 레포의 `Admin_Docs/features/F-011-웹-대시보드/feature.md`에 있다.
