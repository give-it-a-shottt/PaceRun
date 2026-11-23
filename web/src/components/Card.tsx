import type { ReactNode } from 'react';

import styles from './Card.module.css';

type CardProps = {
  children: ReactNode;
  className?: string;
  /** 카드의 이름이 되는 제목 요소의 id */
  labelledBy?: string;
  /** 읽는 중 */
  busy?: boolean;
  /** 안의 요소 사이를 띄우지 않는다(표처럼 줄이 붙어 있는 내용) */
  flush?: boolean;
};

/** 흰 바탕 카드(피그마의 카드 틀: 테두리 line/regular · radius/card · 안쪽 여백 24) */
export function Card({ children, className, labelledBy, busy, flush }: CardProps) {
  const classNames = [styles.card, flush && styles.flush, className].filter(Boolean).join(' ');
  return (
    <section
      className={classNames}
      aria-labelledby={labelledBy}
      aria-busy={busy || undefined}
    >
      {children}
    </section>
  );
}
