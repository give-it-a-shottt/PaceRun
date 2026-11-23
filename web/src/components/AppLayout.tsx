import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { logOut } from '../api/session';
import { useSession } from '../app/useSession';
import logoMark from '../assets/logo-mark.svg';
import styles from './AppLayout.module.css';
import { ErrorBoundary } from './ErrorBoundary';

/** 기획: 웹 헤더의 로고 32 */
const LOGO_SIZE = 32;

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab;
}

/** 로그인한 화면의 공통 틀: 위 GNB · 가운데 1200 컨테이너 · 아래 Footer */
export function AppLayout() {
  const session = useSession();
  const location = useLocation();
  const [logOutStatus, setLogOutStatus] = useState<'idle' | 'pending' | 'failed'>('idle');

  // logOut은 던지지 않는다. 되면 상태가 signedOut이 되어 로그인 화면으로 간다(app/guards.tsx).
  // 서버에 닿지 못하면 로그인된 채로 남으므로, 알리고 다시 누를 수 있게 한다.
  const handleLogOut = async () => {
    setLogOutStatus('pending');
    const loggedOut = await logOut();
    if (!loggedOut) setLogOutStatus('failed');
  };

  return (
    <div className={styles.shell}>
      <header className={styles.gnb}>
        <div className={styles.gnbInner}>
          <Link to="/" className={styles.brand}>
            <img src={logoMark} alt="" width={LOGO_SIZE} height={LOGO_SIZE} />
            <span>Pace Run</span>
          </Link>
          <nav className={styles.tabs} aria-label="주 메뉴">
            {/* end: "/runs"에서 대시보드 탭이 함께 켜지지 않게 */}
            <NavLink to="/" end className={tabClassName}>
              대시보드
            </NavLink>
            <NavLink to="/runs" className={tabClassName}>
              기록
            </NavLink>
          </nav>
          <div className={styles.account}>
            <span className={styles.email}>{session.user?.email}</span>
            <button
              type="button"
              className={styles.logOut}
              onClick={handleLogOut}
              disabled={logOutStatus === 'pending'}
            >
              로그아웃
            </button>
            {logOutStatus === 'failed' && (
              <p className={styles.logOutError} role="alert">
                로그아웃하지 못했어요. 서버에 연결되면 다시 시도해 주세요
              </p>
            )}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        {/* 화면 하나가 그리다 실패해도 GNB는 남는다. key: 다른 주소로 옮기면 경계를 새로 시작한다. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className={styles.footer}>
        <p className={styles.footerInner}>© Pace Run</p>
      </footer>
    </div>
  );
}
