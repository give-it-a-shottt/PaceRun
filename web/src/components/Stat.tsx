import { Skeleton } from './LoadState';
import styles from './Stat.module.css';

/** 지표 하나: 값 + 라벨(피그마 Stat L) */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      {/* 읽어 주는 순서는 라벨 → 값, 보이는 순서는 값 → 라벨 */}
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  );
}

/** 읽는 중: Stat 하나의 자리(값 줄 + 라벨 줄)를 잡아 둔다. */
export function StatSkeleton() {
  return (
    <div className={styles.statSkeleton} aria-hidden>
      <Skeleton className={styles.valueSkeleton} />
      <Skeleton className={styles.labelSkeleton} />
    </div>
  );
}
