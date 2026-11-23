import { useInfiniteQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { fetchRunsPage } from '../../api/runs';
import { hasFailed, isShownFailure } from '../../app/queryClient';
import { Card } from '../../components/Card';
import { EmptyText, LoadError, LoadingText } from '../../components/LoadState';
import { RunsTable, RunsTableSkeleton } from '../../components/RunsTable';
import { describeRunRow } from '../../domain/runView';
import styles from './RunsPage.module.css';

/** 한 번에 읽는 줄 수 */
const PAGE_SIZE = 20;
/** 처음 읽는 동안 자리를 잡아 두는 줄 수 */
const SKELETON_ROWS = 8;

/** 러닝 목록("기록" 탭). 대시보드의 "최근 러닝"과 같은 표를 쓰고 [더 보기]로 다음 쪽을 이어 붙인다. */
export function RunsPage() {
  const titleId = useId();
  const runsQuery = useInfiniteQuery({
    queryKey: ['runs', 'list', PAGE_SIZE],
    queryFn: ({ pageParam }) => fetchRunsPage(pageParam, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });

  const rows = runsQuery.data?.pages.flatMap((page) => page.items.map(describeRunRow));
  const nextFailed = runsQuery.isFetchNextPageError && isShownFailure(runsQuery.error);
  const loadMore = () => void runsQuery.fetchNextPage();

  return (
    <>
      <h1 id={titleId} className={styles.title}>
        기록
      </h1>
      <Card labelledBy={titleId} busy={runsQuery.isPending} flush>
        {rows ? (
          rows.length > 0 ? (
            <RunsTable rows={rows} label="러닝 기록" />
          ) : (
            <EmptyText>아직 러닝 기록이 없어요</EmptyText>
          )
        ) : hasFailed(runsQuery) ? (
          <LoadError onRetry={() => void runsQuery.refetch()} />
        ) : (
          <>
            <RunsTableSkeleton rowCount={SKELETON_ROWS} />
            <LoadingText />
          </>
        )}

        {rows && nextFailed && <LoadError onRetry={loadMore} />}
        {rows && !nextFailed && runsQuery.hasNextPage && (
          <div className={styles.more}>
            <button
              type="button"
              className={styles.moreButton}
              onClick={loadMore}
              disabled={runsQuery.isFetchingNextPage}
              aria-busy={runsQuery.isFetchingNextPage || undefined}
            >
              {runsQuery.isFetchingNextPage ? '불러오는 중' : '더 보기'}
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
