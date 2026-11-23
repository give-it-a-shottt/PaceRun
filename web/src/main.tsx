import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// 바탕 스타일을 컴포넌트의 스타일보다 먼저 불러온다(같은 무게의 규칙이면 컴포넌트 쪽이 이기게)
import './styles/tokens.css';
import './styles/global.css';

import { restoreSession } from './api/session';
import App from './App';

// 사이트를 열 때 한 번: 쿠키로 로그인 상태를 되살린다(끝날 때까지 화면은 비워 둔다 — components/SessionGuards.tsx)
void restoreSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
