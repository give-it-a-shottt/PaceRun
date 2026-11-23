import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ClearCacheOnSignOut, GuestOnly, RequireSession } from './components/SessionGuards';
import { createQueryClient } from './app/queryClient';
import { AppLayout } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LoginPage } from './pages/login/LoginPage';
import { RunDetailPage } from './pages/runDetail/RunDetailPage';
import { RunsPage } from './pages/runs/RunsPage';

export default function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ClearCacheOnSignOut />
      <BrowserRouter>
        {/* 어느 화면에서든 그리다 예외가 나면 빈 화면 대신 안내를 보여 준다. 로그인한 화면은 AppLayout 안에 경계가 하나 더 있다. */}
        <ErrorBoundary>
          <Routes>
            <Route
              path="/login"
              element={
                <GuestOnly>
                  <LoginPage />
                </GuestOnly>
              }
            />
            <Route
              element={
                <RequireSession>
                  <AppLayout />
                </RequireSession>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="runs" element={<RunsPage />} />
              <Route path="runs/:id" element={<RunDetailPage />} />
            </Route>
            {/* 없는 주소는 대시보드로(로그인 전이면 거기서 로그인 화면으로 간다) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
