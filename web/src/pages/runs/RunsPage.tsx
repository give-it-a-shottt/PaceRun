import { useInfiniteQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { fetchRunsPage } from '../../api/runs';
import { hasFailed, isShownFailure } from '../../app/queryClient';
import { Card } from '../../components/Card';
import { LoadError } from '../../components/LoadState';
import { LoadedRunsTable } from '../../components/RunsTable';
import { describeRunRow } from '../../domain/runView';
import styles from './RunsPage.module.css';

/** 한 번에 읽는 줄 수 */
const PAGE_SIZE = 20;
/** 처음 읽는 동안 자리를 잡아 두는 줄 수 */
const SKELETON_ROWS = 8;

type MoreRowsProps = {
  /** 다음 쪽이 남아 있다 */
  hasMore: boolean;
  /** 다음 쪽을 읽는 중 */
  loading: boolean;
  /** 다음 쪽 읽기가 실패함 */
  failed: boolean;
  onLoad: () => void;
};

/** 표 아래: 다음 쪽 읽기가 실패했으면 다시 시도, 남은 쪽이 있으면 [더 보기], 끝이면 아무것도 없다. */
function MoreRows({ hasMore, loading, failed, onLoad }: MoreRowsProps) {
  if (failed) return <LoadError onRetry={onLoad} />;
  if (!hasMore) return null;
  return (
    <div className={styles.more}>
      <button
        type="button"
        className={styles.moreButton}
        onClick={onLoad}
        disabled={loading}
        aria-busy={loading || undefined}
      >
        {loading ? '불러오는 중' : '더 보기'}
      </button>
    </div>
  );
}

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

  return (
    <>
      <h1 id={titleId} className={styles.title}>
        기록
      </h1>
      <Card labelledBy={titleId} busy={runsQuery.isPending} flush>
        <LoadedRunsTable
          rows={rows}
          failed={hasFailed(runsQuery)}
          onRetry={() => void runsQuery.refetch()}
          label="러닝 기록"
          skeletonRows={SKELETON_ROWS}
        />
        {rows && (
          <MoreRows
            hasMore={runsQuery.hasNextPage}
            loading={runsQuery.isFetchingNextPage}
            failed={runsQuery.isFetchNextPageError && isShownFailure(runsQuery.error)}
            onLoad={() => void runsQuery.fetchNextPage()}
          />
        )}
      </Card>
    </>
  );
}
