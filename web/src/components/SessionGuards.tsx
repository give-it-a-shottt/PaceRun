import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { retryRestoreSession } from '../api/session';
import { useSession } from '../app/useSession';
import { ErrorNotice } from './LoadState';

/** 쿠키로 로그인을 되살리는 동안: 로그인 화면이 잠깐 보였다 사라지지 않게 비워 둔다. */
function SessionLoading() {
  return (
    <div role="status">
      <span className="visually-hidden">불러오는 중이에요</span>
    </div>
  );
}

/**
 * 사이트를 열 때 서버에 닿지 못해 로그인 여부를 모르는 상태: 로그인 화면으로 보내지 않고 다시 시도하게 한다
 * (쿠키가 살아 있는 사람에게 비밀번호를 다시 치게 하지 않으려고).
 */
function SessionUnreachable() {
  return (
    <ErrorNotice
      message="서버에 연결하지 못했어요"
      actionLabel="다시 시도"
      onAction={() => void retryRestoreSession()}
    />
  );
}

/** 로그인해야 보는 주소. 로그인이 안 됐거나 조회 중에 풀리면 로그인 화면으로 보낸다. */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'loading') return <SessionLoading />;
  if (session.status === 'unreachable') return <SessionUnreachable />;
  if (session.status === 'signedOut') return <Navigate to="/login" replace />;
  return children;
}

/** 로그인 화면. 이미 로그인했으면 대시보드로 보낸다. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === 'loading') return <SessionLoading />;
  if (session.status === 'unreachable') return <SessionUnreachable />;
  if (session.status === 'signedIn') return <Navigate to="/" replace />;
  return children;
}

/** 로그아웃하거나 로그인이 풀리면 읽어 둔 기록을 지운다(다른 계정으로 로그인했을 때 앞 사람의 기록이 보이지 않게). */
export function ClearCacheOnSignOut() {
  const session = useSession();
  const queryClient = useQueryClient();
  const signedOut = session.status === 'signedOut';
  useEffect(() => {
    if (signedOut) queryClient.clear();
  }, [signedOut, queryClient]);
  return null;
}
