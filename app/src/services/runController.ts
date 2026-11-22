/**
 * 러닝 한 번의 진행을 맡는 곳. 위치 · 타이머 → 계산(domain/runEngine) → 화면 상태 · DB · 음성으로 잇는다.
 *
 * - 계산은 전부 순수 함수(runEngine)에 맡기고, 여기서는 "언제 부르고 결과를 어디로 보낼지"만 정한다.
 * - 화면(React) 밖에서도 돌아야 해서(화면이 꺼져 있거나 화면 없이 프로세스만 살아난 경우) 컴포넌트가 아니라 모듈로 둔다.
 * - 상태는 메모리에 한 벌(state), DB에 한 벌(active_run) 있다. 메모리가 날아가면 DB에서 되살린다.
 */
import * as Crypto from 'expo-crypto';

import { closeOrphanRuns, deleteRun, insertRun, loadActiveRun, saveFinishedRun, saveProgress } from '@/db/runsRepo';
import { loadSettings } from '@/db/settingsRepo';
import {
  applyLocation,
  elapsedMs,
  finish,
  pause,
  resume,
  startRun,
  suspendAt,
  tick,
  type Cue,
  type LocationFix,
  type RunPoint,
  type RunState,
  type RunSummary,
  type StepOptions,
} from '@/domain/runEngine';
import type { RunConfig } from '@/domain/types';
import { useRunStore } from '@/state/runStore';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';

import { isAppVisible } from './appVisibility';
import { startMetronome, stopMetronome } from './metronome';
import { setLocationListener, startLocationUpdates, stopLocationUpdates, isLocationRunning } from './runLocation';
import { showRunControl, startRunControl, stopRunControl } from './runNotification';
import { prepareVoice, releaseVoice, say, type VoiceMixing } from './voice';

const TICK_INTERVAL_MS = 1000;
/** 진행 값을 DB에 쓰는 최소 간격 */
const SAVE_INTERVAL_MS = 1000;
/** 저장이 이만큼 연달아 실패하면 화면에 알린다 */
const SAVE_FAILURES_BEFORE_WARNING = 5;
/**
 * 마지막 저장이 이 시간 안이면 "기록이 끊기지 않고 이어지고 있다"고 본다(러닝 중에는 약 1초마다 저장한다).
 * 이보다 오래됐으면 그 사이 기록이 멈춰 있었던 것이므로, 조용히 이어 가지 않고 사용자에게 묻는다.
 * 위치 작업이 등록돼 있는지만으로는 판단할 수 없다 — 앱이 강제 종료돼도 등록은 남아 있다.
 */
const LIVE_SAVE_GAP_MS = 30_000;

let state: RunState | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
/** 거리로 인정했지만 아직 DB에 쓰지 못한 위치 점 */
let unsavedPoints: RunPoint[] = [];
let lastSavedAt = 0;
let saveFailures = 0;
/**
 * 진행 값 저장을 한 줄로 세운다. DB 쪽(withWriteTransaction)도 줄을 세우지만, 여기서는
 * 저장에 실패한 점을 다음 저장 앞에 다시 끼워 넣는 순서와, 끝낼 때 "앞선 저장이 다 끝난 뒤"를 기다리는 데 쓴다.
 */
let writeQueue: Promise<void> = Promise.resolve();
/** 시작하는 중. 그 사이 다시 시작을 누르거나 홈이 "끝나지 않은 러닝"을 찾지 않게 한다. */
let starting = false;
/** 끝내는 중이면 그 약속. 종료를 두 번 불러도 저장은 한 번만 한다. */
let finishing: Promise<RunSummary | null> | null = null;
/** 화면 없이 되살아나는 중이면 그 약속. 위치가 연달아 와도 되살리기는 한 번만 한다. */
let restoring: Promise<void> | null = null;

let voiceEnabled = true;
let stepOptions: StepOptions = { voiceIntervalKm: 1 };

// 프로세스가 새로 뜨면(앱이 죽었다 위치 작업으로 되살아난 경우) 아무도 startRunSession을 부르지 않는다.
// 그때도 위치를 받을 수 있게, 이 파일이 읽히는 순간 받을 곳을 등록해 둔다(루트 레이아웃이 이 파일을 import한다).
setLocationListener(handleLocations);

/** 설정은 화면 없이 프로세스만 살아났을 때 store에 없을 수 있어, 그때는 DB에서 직접 읽는다. */
async function refreshSettings(): Promise<void> {
  const store = useSettingsStore.getState();
  const settings = store.status === 'ready' ? store.settings : await loadSettings().catch(() => store.settings);
  voiceEnabled = settings.voiceEnabled;
  stepOptions = { voiceIntervalKm: settings.voiceIntervalKm };
}

/**
 * 박자 소리를 지금 상태에 맞춘다: 케이던스 모드로 뛰는 중일 때만 울리고, 일시정지 · 종료 · 다른 모드에서는 끈다.
 * 상태가 바뀌는 곳마다 부르면 되고, 여러 번 불러도 결과가 같다.
 */
function syncMetronome(): void {
  if (state && !finishing && state.status === 'active' && state.config.mode === 'cadence') {
    startMetronome(state.config.spm);
  } else {
    stopMetronome();
  }
}

/** 케이던스 모드는 메트로놈이 계속 울려서, 안내 때 음악을 낮추지 않고 섞는다 */
function voiceMixingFor(config: RunConfig): VoiceMixing {
  return config.mode === 'cadence' ? 'mix' : 'duck';
}

export type StartResult = { ok: true; runId: string } | { ok: false; reason: 'already-running' | 'location' | 'storage' };

/** 새 러닝을 시작한다. 위치 권한 확인은 화면이 먼저 한다(RUN_02_002). */
export async function startRunSession(config: RunConfig, planLabel: string | null): Promise<StartResult> {
  if (state || starting) return { ok: false, reason: 'already-running' };
  starting = true;
  try {
    // 끝나지 않은 러닝이 DB에 남아 있으면 새로 시작하지 않는다. 시작하면 그 러닝의 복구용 상태를 덮어쓴다.
    // (홈은 복구 창을 먼저 띄우지만, 주소로 카운트다운에 바로 들어오는 경우가 있다.)
    if (await loadActiveRun().catch(() => null)) return { ok: false, reason: 'already-running' };

    await refreshSettings();
    const started = startRun({ runId: Crypto.randomUUID(), config, planLabel, now: Date.now() });

    try {
      await insertRun(started.state);
    } catch (error) {
      console.warn('[runController] 러닝을 저장하지 못했어요', error);
      return { ok: false, reason: 'storage' };
    }

    try {
      await startLocationUpdates();
    } catch (error) {
      console.warn('[runController] 위치 받기를 시작하지 못했어요', error);
      // 시작하지 못한 러닝은 흔적을 지운다(0초짜리 기록이나 복구 창이 남지 않게)
      await deleteRun(started.state.runId).catch((cleanupError) => {
        console.warn('[runController] 시작하지 못한 러닝을 지우지 못했어요', cleanupError);
      });
      return { ok: false, reason: 'location' };
    }

    state = started.state;
    await attach();
    deliver(started.cues);
    publish(Date.now());
    queueSave(Date.now(), true);
    return { ok: true, runId: started.state.runId };
  } finally {
    starting = false;
  }
}

/**
 * 진행 중인 러닝에 타이머 · 잠금화면 버튼 · 음성을 붙인다.
 * 새로 시작할 때뿐 아니라, 프로세스가 되살아나거나 앱을 다시 열어 이어 붙을 때도 부른다.
 */
async function attach(): Promise<void> {
  if (!state) return;
  startTimer();
  // 버튼이나 음성 준비가 실패해도 기록은 계속돼야 한다
  await Promise.allSettled([
    startRunControl(
      { onPause: () => void pauseRunSession(), onResume: () => void resumeRunSession() },
      state.status === 'paused',
    ),
    prepareVoice(voiceMixingFor(state.config)),
  ]);
  syncMetronome();
}

function startTimer(): void {
  stopTimer();
  timer = setInterval(() => advance(Date.now(), []), TICK_INTERVAL_MS);
}

function stopTimer(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** 위치가 들어오면 불린다. 화면이 꺼져 타이머가 멈춰도 이쪽으로 계산이 이어진다. */
function handleLocations(fixes: LocationFix[]): void {
  if (finishing || starting) return;
  if (state) {
    advance(Date.now(), fixes);
    return;
  }
  // 러닝 중이 아닌데 위치가 왔다: 프로세스가 죽었다 위치 작업으로 되살아났거나, 끄지 못한 위치 작업이 남아 있다
  restoring ??= restoreOrStop(fixes).finally(() => {
    restoring = null;
  });
}

async function restoreOrStop(fixes: LocationFix[]): Promise<void> {
  const saved = await loadActiveRun().catch(() => null);
  if (state || starting) return; // 그 사이 화면이 러닝을 시작했거나 이어 붙였다
  if (!saved || Date.now() - saved.savedAt > LIVE_SAVE_GAP_MS) {
    // 되살릴 러닝이 없거나, 기록이 한참 끊겨 있었다(앱이 강제 종료된 뒤 다시 켜진 경우 등).
    // 끊겨 있던 시간을 뛴 시간으로 치지 않도록 여기서 이어 가지 않고 위치 받기와 조작 알림을 끈다.
    // 끝나지 않은 러닝은 DB에 남아 있고, 화면이 뜨면 "이어서 / 여기까지 저장"을 묻는다.
    await stopStrayTracking();
    return;
  }
  state = saved.state;
  await refreshSettings();
  await attach();
  advance(Date.now(), fixes);
}

/**
 * 러닝 중이 아닌데 남아 있는 위치 작업과 잠금화면 조작 알림을 끈다.
 * 앱이 강제 종료되면 둘 다 남는다. 조작 알림은 밀어서 지울 수 없게 고정돼 있어 꼭 지워 줘야 한다.
 */
async function stopStrayTracking(): Promise<void> {
  const results = await Promise.allSettled([stopLocationUpdates(), stopRunControl()]);
  for (const result of results) {
    if (result.status === 'rejected') console.warn('[runController] 남아 있는 위치 받기 · 알림을 끄지 못했어요', result.reason);
  }
}

/** 한 걸음 계산: 새 위치를 반영하고, 지금 시각으로 안내를 고르고, 화면 · DB · 음성에 보낸다. */
function advance(now: number, fixes: LocationFix[]): void {
  // 끝내는 중에는 더 계산하지 않는다. 저장이 끝난 러닝을 다시 "진행 중"으로 덮어쓰지 않기 위해서다.
  if (!state || finishing) return;
  let next = state;
  for (const fix of fixes) {
    const applied = applyLocation(next, fix);
    next = applied.state;
    if (applied.point) unsavedPoints.push(applied.point);
  }
  const stepped = tick(next, now, stepOptions);
  state = stepped.state;
  deliver(stepped.cues);
  // 화면이 꺼져 있거나 앱이 뒤에 있으면 화면을 다시 그리게 하지 않는다(뛰는 동안 대부분 이 상태다).
  // 계산 · 음성 · 저장은 그대로 하고, 화면으로 돌아오면 다음 계산 때(1초 안에) 최신 값이 보인다.
  if (isAppVisible()) publish(now);
  queueSave(now, false);
}

function deliver(cues: Cue[]): void {
  for (const cue of cues) {
    if (voiceEnabled) {
      try {
        say(cue.speech);
      } catch (error) {
        // 안내를 말하지 못해도 계산 · 저장은 이어져야 한다
        console.warn('[runController] 안내를 말하지 못했어요', error);
      }
    }
    if (cue.toast) showToast(cue.display);
  }
}

function publish(now: number): void {
  useRunStore.setState({ run: state, now });
}

function queueSave(now: number, force: boolean): void {
  if (!state) return;
  if (!force && now - lastSavedAt < SAVE_INTERVAL_MS) return;
  lastSavedAt = now;
  const snapshot = state;
  const points = unsavedPoints;
  unsavedPoints = [];
  writeQueue = writeQueue.then(async () => {
    try {
      await saveProgress({ state: snapshot, elapsedMs: elapsedMs(snapshot, now), points, now });
      if (saveFailures > 0) {
        saveFailures = 0;
        useRunStore.setState({ saveFailing: false });
      }
    } catch (error) {
      // 쓰지 못한 점은 버리지 않고 다음 저장 때 다시 넣는다
      unsavedPoints = [...points, ...unsavedPoints];
      saveFailures += 1;
      console.warn('[runController] 진행 값을 저장하지 못했어요', error);
      if (saveFailures === SAVE_FAILURES_BEFORE_WARNING) useRunStore.setState({ saveFailing: true });
    }
  });
}

export async function pauseRunSession(): Promise<void> {
  if (!state || finishing) return;
  const now = Date.now();
  const paused = pause(state, now);
  state = paused.state;
  deliver(paused.cues);
  publish(now);
  queueSave(now, true);
  syncMetronome();
  await showRunControl(true);
}

export async function resumeRunSession(): Promise<void> {
  if (!state || finishing) return;
  const now = Date.now();
  const resumed = resume(state, now);
  state = resumed.state;
  deliver(resumed.cues);
  publish(now);
  queueSave(now, true);
  syncMetronome();
  await showRunControl(false);
}

/**
 * 러닝을 끝내고 저장한다. 저장에 실패하면 null을 돌려주고 러닝을 그대로 이어 간다(다시 시도할 수 있게).
 * 끝내는 중에 다시 불러도 저장은 한 번만 하고 같은 결과를 돌려준다.
 */
export function finishRunSession(): Promise<RunSummary | null> {
  if (finishing) return finishing;
  if (!state) return Promise.resolve(null);
  finishing = finishCurrentRun(state).finally(() => {
    finishing = null;
  });
  return finishing;
}

async function finishCurrentRun(current: RunState): Promise<RunSummary | null> {
  // 저장을 기다리는 동안 계산 · 저장이 더 돌지 않게 먼저 멈춘다(advance도 finishing이면 아무것도 하지 않는다)
  stopTimer();
  stopMetronome();
  const summary = finish(current, Date.now());

  // 앞서 줄 세운 쓰기가 끝난 뒤에 마지막 저장을 한다. 그때까지 못 쓴 점을 함께 넣는다.
  await writeQueue;
  try {
    await saveFinishedRun(summary, unsavedPoints);
  } catch (error) {
    console.warn('[runController] 러닝을 끝내지 못했어요', error);
    startTimer();
    // 끝내지 못했으니 러닝은 이어진다. finishing이 풀린 뒤에 박자를 다시 맞춘다.
    setTimeout(syncMetronome, 0);
    return null;
  }

  resetSession();
  // 아래는 실패해도 기록은 이미 저장됐다. 위치 받기가 남으면 다음에 위치가 들어올 때나 홈에서 다시 끈다.
  const results = await Promise.allSettled([stopLocationUpdates(), stopRunControl(), releaseVoice()]);
  for (const result of results) {
    if (result.status === 'rejected') console.warn('[runController] 러닝 뒷정리 중 오류', result.reason);
  }
  return summary;
}

function resetSession(): void {
  stopTimer();
  stopMetronome();
  state = null;
  unsavedPoints = [];
  saveFailures = 0;
  lastSavedAt = 0;
  useRunStore.setState({ run: null, saveFailing: false });
}

export type PendingRun = {
  /** 러닝이 지금도 뒤에서 기록되고 있는지. true면 그냥 러닝 화면으로 돌아가면 된다. */
  stillRunning: boolean;
  elapsedMs: number;
  distanceM: number;
};

/**
 * 끝나지 않은 러닝이 있는지 본다(RUN_02_003 강제 종료 복구). 홈이 보일 때마다 부른다.
 * 방금까지 기록되고 있었으면 화면만 다시 붙이고, 끊겨 있었으면 "이어서 / 여기까지 저장"을 물어야 한다.
 */
export async function checkPendingRun(): Promise<PendingRun | null> {
  if (starting) return null;
  if (state) {
    return { stillRunning: true, elapsedMs: elapsedMs(state, Date.now()), distanceM: state.distanceM };
  }
  const saved = await loadActiveRun();
  if (state || starting) return checkPendingRun(); // 읽는 사이 러닝이 시작되거나 되살아났다
  if (!saved) {
    // 러닝이 없는데 위치 작업 · 알림만 남아 있을 수 있다(지난번에 끄지 못한 경우).
    // 복구할 방법이 없는 '진행 중' 러닝이 남아 있으면 끝난 것으로 닫는다.
    await stopStrayTracking();
    await closeOrphanRuns().catch((error) => {
      console.warn('[runController] 남아 있던 러닝을 닫지 못했어요', error);
    });
    return null;
  }

  const now = Date.now();
  const live = now - saved.savedAt <= LIVE_SAVE_GAP_MS && (await isLocationRunning());
  if (state || starting) return checkPendingRun(); // 확인하는 사이 위치가 들어와 이미 되살아났다
  if (live) {
    state = saved.state;
    await refreshSettings();
    await attach();
    publish(now);
    return { stillRunning: true, elapsedMs: elapsedMs(saved.state, now), distanceM: saved.state.distanceM };
  }

  // 기록이 끊겨 있었다. 남아 있는 위치 작업 · 조작 알림은 끄고, 사용자에게 묻는다.
  await stopStrayTracking();
  // 앱이 꺼져 있던 시간은 일시정지로 친다
  const suspended = suspendAt(saved.state, saved.savedAt);
  return { stillRunning: false, elapsedMs: elapsedMs(suspended, saved.savedAt), distanceM: suspended.distanceM };
}

/** 복구 창에서 [이어서]: 멈춰 있던 러닝을 일시정지 상태로 되살리고 위치 받기를 다시 시작한다. */
export async function continuePendingRun(): Promise<boolean> {
  if (state || starting) return false;
  const saved = await loadActiveRun();
  if (!saved || state || starting) return false;

  starting = true;
  try {
    await refreshSettings();
    try {
      await startLocationUpdates();
    } catch (error) {
      // 끝나지 않은 러닝은 DB에 그대로 둔다. 권한을 고친 뒤 다시 [이어서]를 누르거나 [여기까지 저장]할 수 있다.
      console.warn('[runController] 위치 받기를 다시 시작하지 못했어요', error);
      return false;
    }
    state = suspendAt(saved.state, saved.savedAt);
    await attach();
    publish(Date.now());
  } finally {
    starting = false;
  }
  await resumeRunSession();
  return true;
}

/** 복구 창에서 [여기까지 저장]: 마지막으로 저장된 시각까지를 한 번의 러닝으로 닫는다. */
export async function savePendingRun(): Promise<RunSummary | null> {
  if (state || starting) return null;
  const saved = await loadActiveRun();
  if (!saved) return null;
  const summary = finish(suspendAt(saved.state, saved.savedAt), saved.savedAt);
  try {
    await saveFinishedRun(summary, []);
  } catch (error) {
    console.warn('[runController] 멈춰 있던 러닝을 저장하지 못했어요', error);
    return null;
  }
  await stopStrayTracking();
  return summary;
}
