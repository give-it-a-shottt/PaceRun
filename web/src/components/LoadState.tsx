import { ArrowClockwiseIcon } from '@phosphor-icons/react';

import styles from './LoadState.module.css';

const RETRY_ICON_SIZE = 16;

/** 읽는 중에 자리만 잡아 두는 회색 칸. 크기는 className으로 준다. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={className ? `${styles.skeleton} ${className}` : styles.skeleton} aria-hidden />;
}

/** 읽는 중임을 읽어 주기만 한다(화면에는 Skeleton이 보인다) */
export function LoadingText() {
  return (
    <span className="visually-hidden" role="status">
      불러오는 중이에요
    </span>
  );
}

/** 조회 실패: 문구와 [다시 시도]. 연결 실패와 그 밖의 오류를 같은 문구로 보여 준다. */
export function LoadError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <div className={className ? `${styles.error} ${className}` : styles.error} role="alert">
      <p>불러오지 못했어요</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        <ArrowClockwiseIcon size={RETRY_ICON_SIZE} aria-hidden />
        다시 시도
      </button>
    </div>
  );
}

/** 보여 줄 것이 없을 때의 안내 문구 */
export function EmptyText({ children, className }: { children: string; className?: string }) {
  return <p className={className ? `${styles.empty} ${className}` : styles.empty}>{children}</p>;
}
