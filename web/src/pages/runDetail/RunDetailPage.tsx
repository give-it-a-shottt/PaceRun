import { CaretRightIcon } from '@phosphor-icons/react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useId } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { fetchPreviousComparable, fetchRun } from '../../api/runs';
import { hasFailed } from '../../app/queryClient';
import { Card } from '../../components/Card';
import { EmptyText, LoadError, LoadingText, Skeleton } from '../../components/LoadState';
import { ModeBadge } from '../../components/ModeBadge';
import { Stat, StatSkeleton } from '../../components/Stat';
import { describeRunDetail, type RunDetailView } from '../../domain/runView';
import styles from './RunDetailPage.module.css';

// 지도 라이브러리(leaflet)는 이 화면에서만 쓴다. 경로를 그릴 때 따로 불러온다.
const RouteMap = lazy(() => import('./RouteMap'));

const BREADCRUMB_ICON_SIZE = 16;
/** 지표 카드의 칸 수(거리 · 시간 · 평균 페이스 · 목표) — 읽는 중 자리 잡기용 */
const STAT_COUNT = 4;
const HTTP_NOT_FOUND = 404;
/** 주소의 id가 서버가 받는 모양(UUID)이 아닐 때. 그런 기록은 없는 것이므로 404와 같이 다룬다. */
const HTTP_UNPROCESSABLE = 422;

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === HTTP_NOT_FOUND || error.status === HTTP_UNPROCESSABLE);
}

/** current: 마지막 칸의 글자. 아직 읽는 중이면 pending으로 자리만 잡고, 둘 다 없으면 "기록"만 보여 준다. */
function Breadcrumb({ current, pending }: { current?: string; pending?: boolean }) {
  return (
    <nav aria-label="길잡이">
      <ol className={styles.breadcrumb}>
        <li>
          <Link to="/runs" className={styles.breadcrumbLink}>
            기록
          </Link>
        </li>
        {(current != null || pending) && (
          <li className={styles.breadcrumbCurrent} aria-current="page">
            <CaretRightIcon size={BREADCRUMB_ICON_SIZE} className={styles.breadcrumbCaret} aria-hidden />
            {current ?? <Skeleton className={styles.skeletonBreadcrumb} />}
          </li>
        )}
      </ol>
    </nav>
  );
}

function SegmentsCard({ segments }: { segments: RunDetailView['segments'] }) {
  const titleId = useId();
  return (
    <Card labelledBy={titleId} flush>
      <h2 id={titleId} className={styles.segmentsTitle}>
        구간 기록
      </h2>
      <table className={styles.segments}>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">번호</th>
            <th scope="col">구간</th>
            <th scope="col">시간</th>
            <th scope="col">페이스</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((segment) => (
            <tr key={segment.no} className={segment.resting ? styles.resting : undefined}>
              <td className={styles.segmentNo}>{segment.no}</td>
              <td className={styles.segmentKind}>{segment.kindText}</td>
              <td className={styles.segmentNumber}>{segment.durationText}</td>
              <td className={styles.segmentNumber}>{segment.paceText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function RunDetailContent({ view }: { view: RunDetailView }) {
  return (
    <>
      <header className={styles.head}>
        <div className={styles.titleBlock}>
          <ModeBadge mode={view.mode} label={view.modeLabel} />
          <h1 className={styles.title}>{view.title}</h1>
          <p className={styles.time}>{view.timeText}</p>
          <p className={styles.time}>{view.goalText}</p>
        </div>
        {view.comparison && (
          <div className={styles.comparison}>
            <p className={styles.comparisonText}>{view.comparison.text}</p>
            {view.comparison.detail && <p className={styles.comparisonDetail}>{view.comparison.detail}</p>}
          </div>
        )}
      </header>

      <div className={styles.body}>
        <div className={styles.mapFrame}>
          {view.path.length > 0 ? (
            <Suspense fallback={<Skeleton className={styles.skeletonFill} />}>
              <RouteMap path={view.path} />
            </Suspense>
          ) : (
            <EmptyText>이 러닝에는 경로 기록이 없어요</EmptyText>
          )}
        </div>

        <div className={styles.side}>
          <Card>
            <dl className={styles.stats}>
              {view.stats.map((item) => (
                <Stat key={item.label} label={item.label} value={item.value} />
              ))}
            </dl>
            {view.note && <p className={styles.note}>{view.note}</p>}
          </Card>
          {view.segments.length > 0 && <SegmentsCard segments={view.segments} />}
        </div>
      </div>
    </>
  );
}

function RunDetailSkeleton() {
  return (
    <>
      <div className={styles.titleBlock}>
        <Skeleton className={styles.skeletonBadge} />
        <Skeleton className={styles.skeletonTitle} />
        <Skeleton className={styles.skeletonTime} />
      </div>
      <div className={styles.body}>
        <div className={styles.mapFrame}>
          <Skeleton className={styles.skeletonFill} />
        </div>
        <div className={styles.side}>
          <Card>
            <div className={styles.stats}>
              {Array.from({ length: STAT_COUNT }, (_, index) => (
                <StatSkeleton key={index} />
              ))}
            </div>
          </Card>
        </div>
      </div>
      <LoadingText />
    </>
  );
}

/** WEB_01_003 러닝 상세: 큰 지도(경로), 지표, 구간 표, 같은 모드 지난번과의 비교 */
export function RunDetailPage() {
  const { id = '' } = useParams();
  const runQuery = useQuery({ queryKey: ['run', id], queryFn: () => fetchRun(id) });
  const run = runQuery.data;
  // 같은 모드의 바로 앞 기록은 이 러닝을 읽은 뒤에 찾는다. 실패하면 비교 상자만 그리지 않는다.
  const previousQuery = useQuery({
    queryKey: ['run', id, 'previous'],
    queryFn: run ? () => fetchPreviousComparable(run) : skipToken,
  });

  if (!run) {
    if (isNotFound(runQuery.error)) {
      return (
        <>
          <Breadcrumb />
          <div className={styles.notFound} role="alert">
            <p>기록을 찾지 못했어요</p>
            <Link to="/runs" className={styles.notFoundLink}>
              기록 목록으로 가기
            </Link>
          </div>
        </>
      );
    }
    if (hasFailed(runQuery)) {
      return (
        <>
          <Breadcrumb />
          <LoadError onRetry={() => void runQuery.refetch()} />
        </>
      );
    }
    return (
      <>
        <Breadcrumb pending />
        <RunDetailSkeleton />
      </>
    );
  }

  const view = describeRunDetail(run, previousQuery.isSuccess ? previousQuery.data : 'loading');
  return (
    <>
      <Breadcrumb current={view.breadcrumb} />
      {/* key: 다른 러닝으로 옮기면 지도를 새로 만든다(leaflet은 처음 준 범위만 쓴다) */}
      <RunDetailContent key={run.id} view={view} />
    </>
  );
}
