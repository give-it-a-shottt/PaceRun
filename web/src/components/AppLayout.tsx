import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { logOut } from '../api/session';
import { useSession } from '../app/useSession';
import logoMark from '../assets/logo-mark.svg';
import styles from './AppLayout.module.css';

/** 기획: 웹 헤더의 로고 32 */
const LOGO_SIZE = 32;

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab;
}

/** 로그인한 화면의 공통 틀: 위 GNB · 가운데 1200 컨테이너 · 아래 Footer */
export function AppLayout() {
  const session = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  // logOut은 던지지 않는다. 끝나면 상태가 signedOut이 되어 로그인 화면으로 간다(app/guards.tsx).
  const handleLogOut = () => {
    setLoggingOut(true);
    void logOut();
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
            <button type="button" className={styles.logOut} onClick={handleLogOut} disabled={loggingOut}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p className={styles.footerInner}>© Pace Run</p>
      </footer>
    </div>
  );
}
