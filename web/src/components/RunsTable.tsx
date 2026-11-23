import { CaretRightIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

import type { RunRowView } from '../domain/runView';
import { Skeleton } from './LoadState';
import { ModeBadge } from './ModeBadge';
import styles from './RunsTable.module.css';

const CARET_SIZE = 24;

/** 러닝 목록 표(대시보드의 "최근 러닝"과 기록 화면이 같이 쓴다). 줄을 누르면 러닝 상세로 간다. */
export function RunsTable({ rows, label }: { rows: RunRowView[]; label: string }) {
  return (
    <div role="table" aria-label={label} className={styles.table}>
      <div role="row" className={styles.head}>
        <span role="columnheader">날짜</span>
        <span role="columnheader">모드</span>
        <span role="columnheader">제목</span>
        <span role="columnheader">거리</span>
        <span role="columnheader">시간</span>
        <span role="columnheader">평균 페이스</span>
        <span aria-hidden />
      </div>
      {rows.map((row) => (
        <div role="row" key={row.id} className={styles.row}>
          <span role="cell" className={styles.date}>
            {row.dateText}
          </span>
          <span role="cell">
            <ModeBadge mode={row.mode} label={row.modeLabel} />
          </span>
          <span role="cell" className={styles.title}>
            {/* 링크는 제목에 두고 ::after로 줄 전체를 덮는다: 키보드로는 링크 하나, 마우스로는 줄 어디든 */}
            <Link to={`/runs/${encodeURIComponent(row.id)}`} className={styles.link}>
              {row.title}
            </Link>
          </span>
          <span role="cell" className={styles.number}>
            {row.distanceText}
          </span>
          <span role="cell" className={styles.number}>
            {row.durationText}
          </span>
          <span role="cell" className={styles.number}>
            {row.paceText}
          </span>
          <CaretRightIcon size={CARET_SIZE} className={styles.caret} aria-hidden />
        </div>
      ))}
    </div>
  );
}

/** 읽는 중: 줄 수만큼 자리를 잡아 둔다(표가 나타날 때 아래 내용이 밀리지 않게). */
export function RunsTableSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <div className={styles.table} aria-hidden>
      <div className={styles.head}>
        <span>날짜</span>
        <span>모드</span>
        <span>제목</span>
        <span>거리</span>
        <span>시간</span>
        <span>평균 페이스</span>
        <span />
      </div>
      {Array.from({ length: rowCount }, (_, index) => (
        <div key={index} className={styles.row}>
          <Skeleton className={styles.skeletonCell} />
        </div>
      ))}
    </div>
  );
}
