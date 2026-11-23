import { CaretRightIcon } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

import type { RunRowView } from '../domain/runView';
import { EmptyText, LoadError, LoadingText, Skeleton } from './LoadState';
import { ModeBadge } from './ModeBadge';
import styles from './RunsTable.module.css';

const CARET_SIZE = 24;
/** 머리 칸의 이름(왼쪽 → 오른쪽). 마지막 꺾쇠 칸에는 이름이 없다. 표와 읽는 중 자리 표시가 같이 쓴다. */
const COLUMN_NAMES = ['날짜', '모드', '제목', '거리', '시간', '평균 페이스'];

/** 머리 줄. inTable이 아니면(읽는 중 자리 표시) 표의 역할을 붙이지 않는다. */
function HeadRow({ inTable }: { inTable: boolean }) {
  return (
    <div role={inTable ? 'row' : undefined} className={styles.head}>
      {COLUMN_NAMES.map((name) => (
        <span key={name} role={inTable ? 'columnheader' : undefined}>
          {name}
        </span>
      ))}
      <span aria-hidden />
    </div>
  );
}

/** 러닝 목록 표(대시보드의 "최근 러닝"과 기록 화면이 같이 쓴다). 줄을 누르면 러닝 상세로 간다. */
export function RunsTable({ rows, label }: { rows: RunRowView[]; label: string }) {
  return (
    <div role="table" aria-label={label} className={styles.table}>
      <HeadRow inTable />
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
      <HeadRow inTable={false} />
      {Array.from({ length: rowCount }, (_, index) => (
        <div key={index} className={styles.row}>
          <Skeleton className={styles.skeletonCell} />
        </div>
      ))}
    </div>
  );
}

type LoadedRunsTableProps = {
  /** 그릴 줄들. 아직 읽지 못했으면 undefined */
  rows: RunRowView[] | undefined;
  /** 보여 줄 줄 없이 조회가 실패함 */
  failed: boolean;
  onRetry: () => void;
  label: string;
  /** 읽는 중에 자리를 잡아 둘 줄 수 */
  skeletonRows: number;
};

/** 러닝 목록의 네 가지 모습: 읽는 중(자리 표시) · 실패(다시 시도) · 빈 목록(안내) · 표 */
export function LoadedRunsTable({ rows, failed, onRetry, label, skeletonRows }: LoadedRunsTableProps) {
  if (rows === undefined) {
    if (failed) return <LoadError onRetry={onRetry} />;
    return (
      <>
        <RunsTableSkeleton rowCount={skeletonRows} />
        <LoadingText />
      </>
    );
  }
  if (rows.length === 0) return <EmptyText>아직 러닝 기록이 없어요</EmptyText>;
  return <RunsTable rows={rows} label={label} />;
}
