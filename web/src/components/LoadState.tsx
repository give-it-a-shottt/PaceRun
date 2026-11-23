import { ArrowClockwiseIcon } from '@phosphor-icons/react';

import styles from './LoadState.module.css';

const ACTION_ICON_SIZE = 16;

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

type ErrorNoticeProps = { message: string; actionLabel: string; onAction: () => void };

/** 실패 안내의 공통 모양: 문구 한 줄 + 다시 해 보는 버튼 하나. 놓인 자리의 가운데에 선다. */
export function ErrorNotice({ message, actionLabel, onAction }: ErrorNoticeProps) {
  return (
    <div className={styles.error} role="alert">
      <p>{message}</p>
      <button type="button" className={styles.retry} onClick={onAction}>
        <ArrowClockwiseIcon size={ACTION_ICON_SIZE} aria-hidden />
        {actionLabel}
      </button>
    </div>
  );
}

/** 조회 실패: 문구와 [다시 시도]. 연결 실패와 그 밖의 오류를 같은 문구로 보여 준다. */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return <ErrorNotice message="불러오지 못했어요" actionLabel="다시 시도" onAction={onRetry} />;
}

/** 화면을 그리다 예외가 났을 때: 다시 그려도 같으므로 새로 고침을 권한다. */
export function RenderError() {
  return (
    <ErrorNotice message="화면을 그리지 못했어요" actionLabel="새로 고침" onAction={() => window.location.reload()} />
  );
}

/** 보여 줄 것이 없을 때의 안내 문구 */
export function EmptyText({ children }: { children: string }) {
  return <p className={styles.empty}>{children}</p>;
}
