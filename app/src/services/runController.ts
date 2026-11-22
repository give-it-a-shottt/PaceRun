/**
 * 러닝 한 번의 진행을 맡는 곳. 위치 · 타이머 → 계산(domain/runEngine) → 화면 상태 · DB · 음성으로 잇는다.
 *
 * - 계산은 전부 순수 함수(runEngine)에 맡기고, 여기서는 "언제 부르고 결과를 어디로 보낼지"만 정한다.
 * - 화면(React) 밖에서도 돌아야 해서(화면이 꺼져 있거나 화면 없이 프로세스만 살아난 경우) 컴포넌트가 아니라 모듈로 둔다.
 * - 상태는 메모리에 한 벌(state), DB에 한 벌(active_run) 있다. 메모리가 날아가면 DB에서 되살린다.
 */
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';

import { loadActiveRun, insertRun, saveFinishedRun, saveProgress } from '@/db/runsRepo';
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

import { isLocationRunning, setLocationListener, startLocationUpdates, stopLocationUpdates } from './runLocation';
import { showRunControl, startRunControl, stopRunControl } from './runNotification';
import { prepareVoice, releaseVoice, say } from './voice';

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
/** DB 쓰기를 한 줄로 세워 순서가 뒤바뀌지 않게 한다 */
let writeQueue: Promise<void> = Promise.resolve();

/** 설정은 화면 없이 프로세스만 살아났을 때 store에 없을 수 있어, 그때는 DB에서 직접 읽는다. */
async function currentSettings() {
  const store = useSettingsStore.getState();
  if (store.status === 'ready') return store.settings;
  try {
    return await loadSettings();
  } catch {
    return store.settings;
  }
}

let voiceEnabled = true;
let stepOptions: StepOptions = { voiceIntervalKm: 1 };

async function refreshSettings(): Promise<void> {
  const settings = await currentSettings();
  voiceEnabled = settings.voiceEnabled;
  stepOptions = { voiceIntervalKm: settings.voiceIntervalKm };
}

export type StartResult = { ok: true; runId: string } | { ok: false; reason: 'already-running' | 'location' | 'storage' };

/** 새 러닝을 시작한다. 위치 권한 확인은 화면이 먼저 한다(RUN_02_002). */
export async function startRunSession(config: RunConfig, planLabel: string | null): Promise<StartResult> {
  if (state) return { ok: false, reason: 'already-running' };

  await refreshSettings();
  const started = startRun({ runId: Crypto.randomUUID(), config, planLabel, now: Date.now() });

  try {
    await insertRun(started.state);
  } catch (error) {
    console.warn('[runController] 러닝을 저장하지 못했어요', error);
    return { ok: false, reason: 'storage' };
  }

  state = started.state;
  try {
    await beginTracking();
  } catch (error) {
    console.warn('[runController] 위치 받기를 시작하지 못했어요', error);
    // 시작하지 못한 러닝은 0초짜리 기록으로 닫아 둔다(복구 창이 뜨지 않게)
    await finishRunSession();
    return { ok: false, reason: 'location' };
  }

  // 케이던스 모드는 메트로놈이 계속 울려서, 안내 때 음악을 낮추지 않고 섞는다
  await prepareVoice(config.mode === 'cadence' ? 'mix' : 'duck');
  deliver(started.cues);
  publish(Date.now());
  queueSave(Date.now(), true);
  return { ok: true, runId: started.state.runId };
}

async function beginTracking(): Promise<void> {
  setLocationListener(handleLocations);
  await startLocationUpdates();
  startTimer();
  await startRunControl({ onPause: () => void pauseRunSession(), onResume: () => void resumeRunSession() });
}

function startTimer(): void {
  if (timer) clearInterval(timer);
  timer = setInterval(() => advance(Date.now(), []), TICK_INTERVAL_MS);
}

/** 위치가 들어오면 불린다. 화면이 꺼져 타이머가 멈춰도 이쪽으로 계산이 이어진다. */
function handleLocations(fixes: LocationFix[]): void {
  if (!state) {
    // 프로세스가 죽었다 위치 작업으로 다시 살아난 경우: DB에서 상태를 되살려 이어 간다
    void restoreAndContinue(fixes);
    return;
  }
  advance(Date.now(), fixes);
}

async function restoreAndContinue(fixes: LocationFix[]): Promise<void> {
  const saved = await loadActiveRun().catch(() => null);
  if (state) return; // 그 사이 다른 호출이 이미 되살렸다
  if (!saved || Date.now() - saved.savedAt > LIVE_SAVE_GAP_MS) {
    // 되살릴 러닝이 없거나, 기록이 한참 끊겨 있었다(앱이 강제 종료된 뒤 다시 켜진 경우 등).
    // 끊겨 있던 시간을 뛴 시간으로 치지 않도록 여기서 이어 가지 않고 위치 받기를 끈다.
    // 끝나지 않은 러닝은 DB에 남아 있고, 화면이 뜨면 "이어서 / 여기까지 저장"을 묻는다.
    await stopLocationUpdates().catch(() => undefined);
    return;
  }
  state = saved.state;
  await refreshSettings();
  startTimer();
  advance(Date.now(), fixes);
}

/** 한 걸음 계산: 새 위치를 반영하고, 지금 시각으로 안내를 고르고, 화면 · DB · 음성에 보낸다. */
function advance(now: number, fixes: LocationFix[]): void {
  if (!state) return;
  let next = state;
  for (const fix of fixes) {
    const applied = applyLocation(next, fix);
    next = applied.state;
    if (applied.point) unsavedPoints.push(applied.point);
  }
  const stepped = tick(next, now, stepOptions);
  state = stepped.state;
  deliver(stepped.cues);
  publish(now);
  queueSave(now, false);
}

function deliver(cues: Cue[]): void {
  for (const cue of cues) {
    if (voiceEnabled) say(cue.speech);
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
  if (!state) return;
  const now = Date.now();
  const paused = pause(state, now);
  state = paused.state;
  deliver(paused.cues);
  publish(now);
  queueSave(now, true);
  await showRunControl(true);
}

export async function resumeRunSession(): Promise<void> {
  if (!state) return;
  const now = Date.now();
  const resumed = resume(state, now);
  state = resumed.state;
  deliver(resumed.cues);
  publish(now);
  queueSave(now, true);
  await showRunControl(false);
}

/** 러닝을 끝내고 저장한다. 저장에 실패하면 null을 돌려주고 러닝 상태는 그대로 둔다(다시 시도할 수 있게). */
export async function finishRunSession(): Promise<RunSummary | null> {
  if (!state) return null;
  const summary = finish(state, Date.now());
  const points = unsavedPoints;

  // 앞서 줄 세운 쓰기가 끝난 뒤에 마지막 저장을 한다
  await writeQueue;
  try {
    await saveFinishedRun(summary, points);
  } catch (error) {
    console.warn('[runController] 러닝을 끝내지 못했어요', error);
    return null;
  }

  unsavedPoints = [];
  state = null;
  saveFailures = 0;
  lastSavedAt = 0;
  if (timer) clearInterval(timer);
  timer = null;
  setLocationListener(null);
  useRunStore.setState({ run: null, saveFailing: false });

  // 아래는 실패해도 기록은 이미 저장됐으므로 오류를 삼킨다
  await Promise.allSettled([stopLocationUpdates(), stopRunControl(), releaseVoice()]);
  return summary;
}

export type PendingRun = {
  /** 러닝이 지금도 뒤에서 기록되고 있는지. true면 그냥 러닝 화면으로 돌아가면 된다. */
  stillRunning: boolean;
  elapsedMs: number;
  distanceM: number;
};

/**
 * 앱을 켰을 때 끝나지 않은 러닝이 있는지 본다(RUN_02_003 강제 종료 복구).
 * 위치 받기가 아직 돌고 있으면 화면만 다시 붙이고, 아니면 "이어서 / 여기까지 저장"을 물어야 한다.
 */
export async function checkPendingRun(): Promise<PendingRun | null> {
  if (state) {
    return { stillRunning: true, elapsedMs: elapsedMs(state, Date.now()), distanceM: state.distanceM };
  }
  const saved = await loadActiveRun();
  if (!saved) return null;

  const now = Date.now();
  if (now - saved.savedAt <= LIVE_SAVE_GAP_MS && (await isLocationRunning())) {
    state = saved.state;
    await refreshSettings();
    setLocationListener(handleLocations);
    startTimer();
    publish(now);
    return { stillRunning: true, elapsedMs: elapsedMs(saved.state, now), distanceM: saved.state.distanceM };
  }

  // 기록이 끊겨 있었다. 등록만 남아 있는 위치 작업은 끄고, 사용자에게 묻는다.
  await stopLocationUpdates().catch(() => undefined);
  // 앱이 꺼져 있던 시간은 일시정지로 친다
  const suspended = suspendAt(saved.state, saved.savedAt);
  return { stillRunning: false, elapsedMs: elapsedMs(suspended, saved.savedAt), distanceM: suspended.distanceM };
}

/** 복구 창에서 [이어서]: 멈춰 있던 러닝을 일시정지 상태로 되살리고 위치 받기를 다시 시작한다. */
export async function continuePendingRun(): Promise<boolean> {
  const saved = await loadActiveRun();
  if (!saved) return false;
  state = suspendAt(saved.state, saved.savedAt);
  await refreshSettings();
  try {
    await beginTracking();
  } catch (error) {
    console.warn('[runController] 위치 받기를 다시 시작하지 못했어요', error);
    state = null;
    setLocationListener(null);
    if (timer) clearInterval(timer);
    timer = null;
    return false;
  }
  await prepareVoice(state.config.mode === 'cadence' ? 'mix' : 'duck');
  publish(Date.now());
  await resumeRunSession();
  return true;
}

/** 복구 창에서 [여기까지 저장]: 마지막으로 저장된 시각까지를 한 번의 러닝으로 닫는다. */
export async function savePendingRun(): Promise<RunSummary | null> {
  const saved = await loadActiveRun();
  if (!saved) return null;
  const summary = finish(suspendAt(saved.state, saved.savedAt), saved.savedAt);
  try {
    await saveFinishedRun(summary, []);
  } catch (error) {
    console.warn('[runController] 멈춰 있던 러닝을 저장하지 못했어요', error);
    return null;
  }
  return summary;
}

/** 길게 눌러 종료의 시작 · 끝 진동 */
export function vibrate(kind: 'start' | 'done'): void {
  const run =
    kind === 'start'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  run.catch(() => undefined);
}
