/**
 * 폰의 기록을 서버와 맞춘다: 끝난 러닝 올리기(같은 번호는 서버에 한 건만 — F-009), 서버에만 있는 러닝 내려받기.
 * 기록은 먼저 폰에 저장되고(D-004) 여기서는 그 뒤를 맡는다. 실패해도 기록은 폰에 남아 다음에 다시 올라간다.
 */
import {
  countUnsyncedRuns,
  getRun,
  getRunPoints,
  getRunSegments,
  insertDownloadedRun,
  listRunIds,
  listUnsyncedRunIds,
  markRunSynced,
} from '@/db/runsRepo';
import { fromServerRun, toRunUpload } from '@/domain/syncMapping';
import { useAuthStore, type SyncProblem } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';

import { ApiError, NetworkError } from './apiClient';
import { authorizedRequest, SessionExpiredError } from './session';

/** 목록을 한 번에 이만큼씩 받는다(서버 상한) */
const LIST_PAGE_SIZE = 100;
/** 목록을 끝없이 넘기지 않게 하는 안전장치(100개 × 200쪽 = 2만 건) */
const MAX_LIST_PAGES = 200;
/** 서버가 "이 기록은 받을 수 없다"고 답한 상태 코드. 다시 보내도 같으므로 그 기록만 건너뛴다. */
const REJECTED_STATUSES: readonly number[] = [409, 413, 422];

export type SyncOptions = {
  /** 서버에만 있는 러닝도 내려받을지. 로그인 직후와 [지금 동기화]에서만 켠다(목록을 끝까지 읽어야 해서 무겁다). */
  download: boolean;
};

let current: Promise<void> | null = null;
let queued: SyncOptions | null = null;
/** 서버가 받지 않은 러닝. 앱을 켜 둔 동안에는 다시 보내지 않는다. */
const rejectedIds = new Set<string>();
/** 서버에 마지막으로 올린 주 목표. 같으면 다시 올리지 않는다. */
let pushedWeeklyGoal: number | null = null;

/** 폰에만 있는 기록 수를 다시 센다(화면이 보일 때 · 동기화가 끝날 때). */
export async function refreshLocalOnlyCount(): Promise<void> {
  try {
    useAuthStore.setState({ localOnlyCount: await countUnsyncedRuns() });
  } catch (error) {
    console.warn('[sync] 폰에만 있는 기록 수를 세지 못했어요', error);
  }
}

/**
 * 동기화를 돌린다. 오류를 던지지 않는다 — 결과는 authStore의 syncing · syncProblem으로 알린다.
 * 이미 돌고 있으면 그 뒤에 한 번 더 돌게 예약하고 같은 약속을 돌려준다(겹쳐 돌리지 않는다).
 */
export function syncNow(options: SyncOptions): Promise<void> {
  if (current) {
    queued = { download: (queued?.download ?? false) || options.download };
    return current;
  }
  current = (async () => {
    let next: SyncOptions | null = options;
    while (next) {
      queued = null;
      await runOnce(next);
      next = queued;
    }
  })().finally(() => {
    current = null;
  });
  return current;
}

/** 로그인돼 있을 때만, 올리기만 한다(러닝을 끝냈을 때 · 앱을 켰을 때). */
export function requestBackgroundSync(): void {
  if (useAuthStore.getState().status === 'signedIn') void syncNow({ download: false });
}

function problemOf(error: unknown): SyncProblem {
  if (error instanceof SessionExpiredError) return 'expired';
  if (error instanceof NetworkError) return 'offline';
  return 'server';
}

async function runOnce(options: SyncOptions): Promise<void> {
  if (useAuthStore.getState().status !== 'signedIn') return;
  useAuthStore.setState({ syncing: true, syncProblem: null });
  try {
    await pushWeeklyGoal();
    const unsendable = await uploadPending();
    if (options.download) await downloadMissing();
    useAuthStore.setState({ unsendableCount: unsendable });
    await useSettingsStore.getState().update('lastSyncAt', Date.now());
  } catch (error) {
    // 토큰 · 본문이 섞이지 않게 오류의 종류와 문구만 남긴다
    console.warn('[sync] 동기화를 끝내지 못했어요', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown');
    useAuthStore.setState({ syncProblem: problemOf(error) });
  } finally {
    useAuthStore.setState({ syncing: false });
    await refreshLocalOnlyCount();
  }
}

/** 웹 대시보드의 "주 목표 달성 주 수"가 폰의 주 목표와 같은 기준이 되게 올린다(폰의 값이 기준이다). */
async function pushWeeklyGoal(): Promise<void> {
  const weeklyGoal = useSettingsStore.getState().settings.weeklyGoal;
  if (pushedWeeklyGoal === weeklyGoal) return;
  try {
    await authorizedRequest('PATCH', '/me', { weekly_goal: weeklyGoal });
    pushedWeeklyGoal = weeklyGoal;
  } catch (error) {
    // 서버가 값을 받지 않는 것(422)은 기록 올리기를 막을 일이 아니다
    if (error instanceof ApiError && REJECTED_STATUSES.includes(error.status)) return;
    throw error;
  }
}

/** 올리지 않은 러닝을 오래된 것부터 올린다. 올릴 수 없는 러닝의 수를 돌려준다. */
async function uploadPending(): Promise<number> {
  let unsendable = 0;
  for (const id of await listUnsyncedRunIds()) {
    if (rejectedIds.has(id)) {
      unsendable += 1;
      continue;
    }
    const run = await getRun(id).catch(() => null);
    if (!run) {
      // 읽을 수 없는 줄(목표값 칸이 깨짐)은 올릴 수 없다
      unsendable += 1;
      continue;
    }
    const [segments, points] = await Promise.all([getRunSegments(id), getRunPoints(id)]);
    const decision = toRunUpload(run, segments, points);
    if (decision.kind === 'skip') {
      unsendable += 1;
      continue;
    }
    try {
      await authorizedRequest('PUT', `/runs/${encodeURIComponent(id)}`, decision.body);
    } catch (error) {
      if (error instanceof ApiError && REJECTED_STATUSES.includes(error.status)) {
        console.warn('[sync] 서버가 받지 않은 기록이 있어요', error.status, error.code);
        rejectedIds.add(id);
        unsendable += 1;
        continue;
      }
      throw error;
    }
    await markRunSynced(id);
  }
  return unsendable;
}

type RunListPage = { items: { id: string }[]; nextCursor: string | null };

function readListPage(payload: unknown): RunListPage {
  const page = payload as { items?: unknown; next_cursor?: unknown } | null;
  if (!page || !Array.isArray(page.items)) throw new ApiError(200, 'BAD_RESPONSE', '서버의 응답을 읽지 못했어요');
  return {
    items: page.items.filter((item): item is { id: string } => typeof item?.id === 'string'),
    nextCursor: typeof page.next_cursor === 'string' ? page.next_cursor : null,
  };
}

/** 서버에만 있는 러닝을 내려받아 폰에 넣는다(새 폰에서 로그인했을 때). 폰에 이미 있는 번호는 건드리지 않는다. */
async function downloadMissing(): Promise<void> {
  const known = new Set(await listRunIds());
  let cursor: string | null = null;
  for (let pageNo = 0; pageNo < MAX_LIST_PAGES; pageNo++) {
    const query: string = `limit=${LIST_PAGE_SIZE}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
    const page: RunListPage = readListPage(await authorizedRequest('GET', `/runs?${query}`));
    for (const item of page.items) {
      if (known.has(item.id)) continue;
      const run = fromServerRun(await authorizedRequest('GET', `/runs/${encodeURIComponent(item.id)}`));
      if (!run) {
        // 모양이 틀린 기록은 폰에 넣지 않는다
        console.warn('[sync] 내려받은 기록의 모양이 달라 건너뛰었어요');
        continue;
      }
      await insertDownloadedRun(run);
      known.add(item.id);
    }
    if (!page.nextCursor) return;
    cursor = page.nextCursor;
  }
}

// 로그아웃하면 기억해 둔 것을 지운다(다음에 로그인하는 계정은 다른 계정일 수 있다)
useAuthStore.subscribe((state, previous) => {
  if (state.status === 'signedOut' && previous.status !== 'signedOut') {
    rejectedIds.clear();
    pushedWeeklyGoal = null;
  }
});
