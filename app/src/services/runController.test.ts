import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocationFix, RunState } from '@/domain/runEngine';
import { DEFAULT_SETTINGS } from '@/domain/types';

// 기기 기능(DB · 위치 · 알림 · 음성 · 진동)은 모두 가짜로 바꿔, 진행 관리자가
// "언제 무엇을 부르는지"와 실패했을 때의 처리만 본다. 계산 자체는 runEngine 테스트가 맡는다.
vi.mock('@/db/runsRepo', () => ({
  closeOrphanRuns: vi.fn(),
  deleteRun: vi.fn(),
  insertRun: vi.fn(),
  saveProgress: vi.fn(),
  saveFinishedRun: vi.fn(),
  loadActiveRun: vi.fn(),
}));
vi.mock('@/db/settingsRepo', () => ({ loadSettings: vi.fn(), saveSetting: vi.fn() }));
vi.mock('./runLocation', () => ({
  setLocationListener: vi.fn(),
  startLocationUpdates: vi.fn(),
  stopLocationUpdates: vi.fn(),
  isLocationRunning: vi.fn(),
}));
vi.mock('./runNotification', () => ({
  startRunControl: vi.fn(),
  showRunControl: vi.fn(),
  stopRunControl: vi.fn(),
}));
vi.mock('./voice', () => ({ prepareVoice: vi.fn(), releaseVoice: vi.fn(), say: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'run-uuid' }));
vi.mock('./appVisibility', () => ({ isAppVisible: vi.fn(() => true) }));
vi.mock('./metronome', () => ({ startMetronome: vi.fn(), stopMetronome: vi.fn() }));

const T0 = 1_700_000_000_000;
const DEG_PER_M = 1 / 111_194.9;
const FREE = { mode: 'free', targetDurationSec: null } as const;

function fixAt(sec: number, meters: number): LocationFix {
  return { t: T0 + sec * 1000, lat: 37.5 + meters * DEG_PER_M, lng: 127, accuracy: 5 };
}

/** 모듈 안에 상태를 들고 있으므로, 테스트마다 새로 불러와 깨끗한 상태에서 시작한다. */
async function setup(options: { voiceEnabled?: boolean } = {}) {
  vi.resetModules();
  const repo = vi.mocked(await import('@/db/runsRepo'));
  const settingsRepo = vi.mocked(await import('@/db/settingsRepo'));
  const location = vi.mocked(await import('./runLocation'));
  const notification = vi.mocked(await import('./runNotification'));
  const voice = vi.mocked(await import('./voice'));
  const visibility = vi.mocked(await import('./appVisibility'));
  const metronome = vi.mocked(await import('./metronome'));
  const { useSettingsStore } = await import('@/state/settingsStore');
  const { useRunStore } = await import('@/state/runStore');
  const { useToastStore } = await import('@/state/toastStore');
  const controller = await import('./runController');
  // 진행 관리자는 읽히는 순간 위치 받을 곳을 등록한다(프로세스가 되살아났을 때도 받기 위해)
  const listener = location.setLocationListener.mock.calls.at(-1)?.[0];
  if (!listener) throw new Error('위치 리스너가 등록되지 않았어요');

  vi.clearAllMocks();
  repo.closeOrphanRuns.mockResolvedValue(undefined);
  repo.deleteRun.mockResolvedValue(undefined);
  repo.insertRun.mockResolvedValue(undefined);
  repo.saveProgress.mockResolvedValue(undefined);
  repo.saveFinishedRun.mockResolvedValue(undefined);
  repo.loadActiveRun.mockResolvedValue(null);
  settingsRepo.loadSettings.mockResolvedValue(DEFAULT_SETTINGS);
  location.startLocationUpdates.mockResolvedValue(undefined);
  location.stopLocationUpdates.mockResolvedValue(undefined);
  location.isLocationRunning.mockResolvedValue(false);
  visibility.isAppVisible.mockReturnValue(true);
  notification.startRunControl.mockResolvedValue(undefined);
  notification.showRunControl.mockResolvedValue(undefined);
  notification.stopRunControl.mockResolvedValue(undefined);
  voice.prepareVoice.mockResolvedValue(undefined);
  voice.releaseVoice.mockResolvedValue(undefined);
  metronome.startMetronome.mockReturnValue(true);

  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, voiceEnabled: options.voiceEnabled ?? true },
    status: 'ready',
  });

  /** 진행 관리자가 위치 작업에 등록한 함수로 위치를 흘려 넣는다 */
  const sendLocations = (fixes: LocationFix[]) => listener(fixes);

  return { controller, repo, location, notification, voice, visibility, metronome, useRunStore, useToastStore, sendLocations };
}

/** 줄 세운 DB 쓰기(약속)가 끝날 때까지 기다린다 */
async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('시작', () => {
  it('러닝을 저장하고, 위치 받기 · 조작 알림을 켜고, "시작합니다"를 말한다', async () => {
    const { controller, repo, location, notification, voice, useRunStore } = await setup();

    const result = await controller.startRunSession(FREE, '자유 20분');

    expect(result).toEqual({ ok: true, runId: 'run-uuid' });
    expect(repo.insertRun).toHaveBeenCalledTimes(1);
    expect(location.startLocationUpdates).toHaveBeenCalledTimes(1);
    expect(notification.startRunControl).toHaveBeenCalledTimes(1);
    expect(voice.say).toHaveBeenCalledWith('시작합니다');
    expect(useRunStore.getState().run).toMatchObject({ runId: 'run-uuid', status: 'active', planLabel: '자유 20분' });
  });

  it('케이던스 모드는 안내 때 음악을 낮추지 않고 섞는다', async () => {
    const { controller, voice } = await setup();
    await controller.startRunSession({ mode: 'cadence', spm: 170, durationSec: 1200 }, null);
    expect(voice.prepareVoice).toHaveBeenCalledWith('mix');
  });

  it('이미 러닝 중이면 새로 시작하지 않는다', async () => {
    const { controller, repo } = await setup();
    await controller.startRunSession(FREE, null);
    const second = await controller.startRunSession(FREE, null);
    expect(second).toEqual({ ok: false, reason: 'already-running' });
    expect(repo.insertRun).toHaveBeenCalledTimes(1);
  });

  it('DB에 저장하지 못하면 시작하지 않고 위치도 켜지 않는다', async () => {
    const { controller, repo, location, useRunStore } = await setup();
    repo.insertRun.mockRejectedValue(new Error('disk'));

    const result = await controller.startRunSession(FREE, null);

    expect(result).toEqual({ ok: false, reason: 'storage' });
    expect(location.startLocationUpdates).not.toHaveBeenCalled();
    expect(useRunStore.getState().run).toBeNull();
  });

  it('위치 받기를 켜지 못하면 만든 러닝을 흔적 없이 지우고, 다시 시작할 수 있는 상태로 돌아간다', async () => {
    const { controller, repo, location, useRunStore } = await setup();
    location.startLocationUpdates.mockRejectedValueOnce(new Error('permission'));

    const result = await controller.startRunSession(FREE, null);

    expect(result).toEqual({ ok: false, reason: 'location' });
    // 0초짜리 기록이나 복구 창이 남지 않게 지운다
    expect(repo.deleteRun).toHaveBeenCalledWith('run-uuid');
    expect(repo.saveFinishedRun).not.toHaveBeenCalled();
    expect(useRunStore.getState().run).toBeNull();

    const retry = await controller.startRunSession(FREE, null);
    expect(retry.ok).toBe(true);
  });

  it('시작하지 못한 러닝을 지우는 것까지 실패해도 다음 시작은 막히지 않는다', async () => {
    const { controller, repo, location } = await setup();
    location.startLocationUpdates.mockRejectedValueOnce(new Error('permission'));
    repo.deleteRun.mockRejectedValueOnce(new Error('disk'));

    expect(await controller.startRunSession(FREE, null)).toEqual({ ok: false, reason: 'location' });
    expect((await controller.startRunSession(FREE, null)).ok).toBe(true);
  });

  it('시작을 동시에 두 번 불러도 러닝은 하나만 만들어진다', async () => {
    const { controller, repo } = await setup();

    const [first, second] = await Promise.all([
      controller.startRunSession(FREE, null),
      controller.startRunSession(FREE, null),
    ]);

    expect([first.ok, second.ok].sort()).toEqual([false, true]);
    expect(repo.insertRun).toHaveBeenCalledTimes(1);
  });
});

describe('위치 · 타이머 → 계산 → 저장', () => {
  it('위치가 들어오면 거리를 더하고, 인정한 점을 진행 값과 함께 저장한다', async () => {
    const { controller, repo, useRunStore, sendLocations } = await setup();
    await controller.startRunSession(FREE, null);
    await flush();
    repo.saveProgress.mockClear();

    vi.setSystemTime(T0 + 1000);
    sendLocations([fixAt(1, 0)]);
    vi.setSystemTime(T0 + 2000);
    sendLocations([fixAt(2, 3)]);
    await flush();

    expect(useRunStore.getState().run?.distanceM).toBeCloseTo(3, 1);
    const savedPoints = repo.saveProgress.mock.calls.flatMap(([args]) => args.points);
    expect(savedPoints).toHaveLength(2);
    expect(repo.saveProgress.mock.calls.at(-1)?.[0]).toMatchObject({ elapsedMs: 2000 });
  });

  it('위치가 오지 않아도 1초 타이머로 화면의 "지금 시각"이 갱신된다', async () => {
    const { controller, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);

    await vi.advanceTimersByTimeAsync(3000);

    expect(useRunStore.getState().now).toBe(T0 + 3000);
  });

  it('화면이 꺼져 있으면 화면 갱신은 건너뛰지만 계산 · 저장 · 음성은 계속한다', async () => {
    const { controller, repo, voice, visibility, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);
    await flush();
    repo.saveProgress.mockClear();
    visibility.isAppVisible.mockReturnValue(false);

    await vi.advanceTimersByTimeAsync(600_000);

    // 화면 상태는 꺼지기 전 그대로다
    expect(useRunStore.getState().now).toBe(T0);
    expect(repo.saveProgress).toHaveBeenCalled();
    expect(voice.say).toHaveBeenCalledWith('오늘 1회 인정!');

    // 화면으로 돌아오면 다음 계산 때 최신 값이 보인다
    visibility.isAppVisible.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(useRunStore.getState().now).toBe(T0 + 601_000);
    expect(useRunStore.getState().run?.counted).toBe(true);
  });

  it('10분을 채우면 음성과 토스트로 알린다', async () => {
    const { controller, voice, useToastStore } = await setup();
    await controller.startRunSession(FREE, null);

    await vi.advanceTimersByTimeAsync(600_000);

    expect(voice.say).toHaveBeenCalledWith('오늘 1회 인정!');
    expect(useToastStore.getState().message).toBe('오늘 1회 인정!');
  });

  it('안내를 말하다 오류가 나도 러닝은 시작되고 계산 · 저장이 이어진다', async () => {
    const { controller, repo, voice, useRunStore } = await setup();
    voice.say.mockImplementation(() => {
      throw new Error('tts');
    });

    const result = await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(3000);

    expect(result.ok).toBe(true);
    expect(useRunStore.getState().now).toBe(T0 + 3000);
    expect(repo.saveProgress).toHaveBeenCalled();
  });

  it('음성 안내를 꺼 두면 말하지 않지만 토스트는 띄운다', async () => {
    const { controller, voice, useToastStore } = await setup({ voiceEnabled: false });
    await controller.startRunSession(FREE, null);

    await vi.advanceTimersByTimeAsync(600_000);

    expect(voice.say).not.toHaveBeenCalled();
    expect(useToastStore.getState().message).toBe('오늘 1회 인정!');
  });

  it('저장에 실패한 위치 점은 버리지 않고 다음 저장 때 다시 넣는다', async () => {
    const { controller, repo, sendLocations } = await setup();
    await controller.startRunSession(FREE, null);
    await flush();
    repo.saveProgress.mockClear();
    repo.saveProgress.mockRejectedValueOnce(new Error('disk'));

    vi.setSystemTime(T0 + 1000);
    sendLocations([fixAt(1, 0)]);
    await flush();
    vi.setSystemTime(T0 + 2000);
    sendLocations([fixAt(2, 3)]);
    await flush();

    expect(repo.saveProgress).toHaveBeenCalledTimes(2);
    expect(repo.saveProgress.mock.calls[1][0].points).toHaveLength(2);
  });

  it('저장이 5번 연달아 실패하면 화면에 알리고, 다시 성공하면 알림을 끈다', async () => {
    const { controller, repo, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);
    await flush();
    repo.saveProgress.mockRejectedValue(new Error('disk'));

    await vi.advanceTimersByTimeAsync(5000);
    expect(useRunStore.getState().saveFailing).toBe(true);

    repo.saveProgress.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(1000);
    expect(useRunStore.getState().saveFailing).toBe(false);
  });
});

describe('발걸음 박자(메트로놈)', () => {
  const CADENCE = { mode: 'cadence', spm: 170, durationSec: 1200 } as const;

  it('케이던스 모드로 시작하면 그 박자로 켠다', async () => {
    const { controller, metronome } = await setup();
    await controller.startRunSession(CADENCE, null);
    expect(metronome.startMetronome).toHaveBeenLastCalledWith(170);
  });

  it('다른 모드에서는 켜지 않는다', async () => {
    const { controller, metronome } = await setup();
    await controller.startRunSession(FREE, null);
    expect(metronome.startMetronome).not.toHaveBeenCalled();
  });

  it('박자 소리를 켜지 못하면 화면에 알리고 러닝은 계속한다', async () => {
    const { controller, metronome, useRunStore, useToastStore } = await setup();
    metronome.startMetronome.mockReturnValue(false);

    const result = await controller.startRunSession(CADENCE, null);

    expect(result.ok).toBe(true);
    expect(useRunStore.getState().run).not.toBeNull();
    expect(useToastStore.getState().message).toContain('박자 소리를 켜지 못했어요');
  });

  it('일시정지하면 끄고, 재개하면 다시 켠다', async () => {
    const { controller, metronome } = await setup();
    await controller.startRunSession(CADENCE, null);
    metronome.startMetronome.mockClear();
    metronome.stopMetronome.mockClear();

    await controller.pauseRunSession();
    expect(metronome.stopMetronome).toHaveBeenCalled();
    expect(metronome.startMetronome).not.toHaveBeenCalled();

    await controller.resumeRunSession();
    expect(metronome.startMetronome).toHaveBeenLastCalledWith(170);
  });

  it('끝내면 끈다', async () => {
    const { controller, metronome } = await setup();
    await controller.startRunSession(CADENCE, null);
    metronome.stopMetronome.mockClear();

    await controller.finishRunSession();

    expect(metronome.stopMetronome).toHaveBeenCalled();
  });

  it('끝내는 저장이 실패해 러닝이 이어지면 박자도 다시 켠다', async () => {
    const { controller, repo, metronome } = await setup();
    await controller.startRunSession(CADENCE, null);
    repo.saveFinishedRun.mockRejectedValueOnce(new Error('disk'));
    metronome.startMetronome.mockClear();

    expect(await controller.finishRunSession()).toBeNull();
    await flush();

    expect(metronome.startMetronome).toHaveBeenLastCalledWith(170);
  });

  it('앱을 다시 열어 일시정지 중인 러닝에 이어 붙을 때는 켜지 않는다', async () => {
    const { controller, repo, location, metronome } = await setup();
    const { pause, startRun } = await import('@/domain/runEngine');
    const running = startRun({ runId: 'old-run', config: CADENCE, planLabel: null, now: T0 - 60_000 }).state;
    repo.loadActiveRun.mockResolvedValue({ state: pause(running, T0 - 30_000).state, savedAt: T0 - 2000 });
    location.isLocationRunning.mockResolvedValue(true);

    await controller.checkPendingRun();

    expect(metronome.startMetronome).not.toHaveBeenCalled();
  });
});

describe('일시정지 · 재개', () => {
  it('일시정지하면 경과 시간이 멈추고 알림 버튼이 [재개]로 바뀐다', async () => {
    const { controller, notification, voice, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(5000);

    await controller.pauseRunSession();

    expect(useRunStore.getState().run).toMatchObject({ status: 'paused', pausedAt: T0 + 5000 });
    expect(notification.showRunControl).toHaveBeenLastCalledWith(true);
    expect(voice.say).toHaveBeenCalledWith('일시정지');

    await vi.advanceTimersByTimeAsync(10_000);
    await controller.resumeRunSession();

    expect(useRunStore.getState().run).toMatchObject({ status: 'active', pausedTotalMs: 10_000 });
    expect(notification.showRunControl).toHaveBeenLastCalledWith(false);
  });

  it('잠금화면 알림의 버튼으로도 일시정지 · 재개가 된다', async () => {
    const { controller, notification, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);
    const handlers = notification.startRunControl.mock.calls[0][0];

    handlers.onPause();
    await flush();
    expect(useRunStore.getState().run?.status).toBe('paused');

    handlers.onResume();
    await flush();
    expect(useRunStore.getState().run?.status).toBe('active');
  });
});

describe('종료', () => {
  it('요약을 저장하고 위치 · 알림 · 음성을 끄고 상태를 비운다', async () => {
    const { controller, repo, location, notification, voice, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(61_000);

    const summary = await controller.finishRunSession();

    expect(summary).toMatchObject({ runId: 'run-uuid', elapsedMs: 61_000, counted: false });
    expect(repo.saveFinishedRun).toHaveBeenCalledTimes(1);
    expect(location.stopLocationUpdates).toHaveBeenCalled();
    expect(notification.stopRunControl).toHaveBeenCalled();
    expect(voice.releaseVoice).toHaveBeenCalled();
    expect(useRunStore.getState().run).toBeNull();
  });

  it('저장에 실패하면 null을 돌려주고 러닝을 그대로 둔다. 다시 시도하면 끝낼 수 있다', async () => {
    const { controller, repo, location, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(5000);
    repo.saveFinishedRun.mockRejectedValueOnce(new Error('disk'));

    expect(await controller.finishRunSession()).toBeNull();
    expect(useRunStore.getState().run).not.toBeNull();
    expect(location.stopLocationUpdates).not.toHaveBeenCalled();

    expect(await controller.finishRunSession()).not.toBeNull();
    expect(useRunStore.getState().run).toBeNull();
  });

  it('종료 저장을 기다리는 동안에는 타이머 · 위치가 와도 더 계산하거나 저장하지 않는다', async () => {
    // 끝난 러닝이 뒤늦은 저장으로 다시 "진행 중"이 되거나 위치 점이 두 번 들어가는 것을 막는다
    const { controller, repo, useRunStore, sendLocations } = await setup();
    await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(5000);
    repo.saveProgress.mockClear();

    let finishSave: () => void = () => {};
    repo.saveFinishedRun.mockImplementationOnce(() => new Promise<void>((resolve) => (finishSave = resolve)));
    const finishing = controller.finishRunSession();

    // 저장이 끝나기 전에 타이머가 울리고 위치가 들어온다
    await vi.advanceTimersByTimeAsync(3000);
    sendLocations([fixAt(7, 20)]);
    await flush();
    expect(repo.saveProgress).not.toHaveBeenCalled();

    finishSave();
    const summary = await finishing;
    expect(summary?.elapsedMs).toBe(5000);
    expect(useRunStore.getState().run).toBeNull();
    expect(repo.saveProgress).not.toHaveBeenCalled();
  });

  it('종료 저장을 기다리는 동안 누른 일시정지 · 재개는 무시한다', async () => {
    const { controller, repo, notification } = await setup();
    await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(5000);
    repo.saveProgress.mockClear();
    notification.showRunControl.mockClear();

    let finishSave: () => void = () => {};
    repo.saveFinishedRun.mockImplementationOnce(() => new Promise<void>((resolve) => (finishSave = resolve)));
    const finishing = controller.finishRunSession();
    await flush();

    await controller.pauseRunSession();
    await controller.resumeRunSession();
    expect(repo.saveProgress).not.toHaveBeenCalled();
    expect(notification.showRunControl).not.toHaveBeenCalled();

    finishSave();
    expect(await finishing).not.toBeNull();
  });

  it('종료를 두 번 눌러도 저장은 한 번만 하고 같은 결과를 돌려준다', async () => {
    const { controller, repo } = await setup();
    await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(5000);

    const [first, second] = await Promise.all([controller.finishRunSession(), controller.finishRunSession()]);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(repo.saveFinishedRun).toHaveBeenCalledTimes(1);
  });

  it('종료 저장에 실패하면 타이머를 다시 돌려 러닝을 이어 간다', async () => {
    const { controller, repo, useRunStore } = await setup();
    await controller.startRunSession(FREE, null);
    await vi.advanceTimersByTimeAsync(5000);
    repo.saveFinishedRun.mockRejectedValueOnce(new Error('disk'));

    expect(await controller.finishRunSession()).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);

    expect(useRunStore.getState().now).toBe(T0 + 7000);
  });

  it('위치 끄기가 실패해도 기록은 저장된 것으로 끝낸다', async () => {
    const { controller, location } = await setup();
    await controller.startRunSession(FREE, null);
    location.stopLocationUpdates.mockRejectedValue(new Error('native'));

    await expect(controller.finishRunSession()).resolves.not.toBeNull();
  });

  it('러닝 중이 아니면 아무것도 하지 않는다', async () => {
    const { controller, repo } = await setup();
    expect(await controller.finishRunSession()).toBeNull();
    expect(repo.saveFinishedRun).not.toHaveBeenCalled();
  });
});

describe('강제 종료 복구', () => {
  /** 120초 뛰고 마지막으로 저장된 뒤 앱이 죽은 상황의 저장 상태를 만든다 */
  async function savedRun(): Promise<{ state: RunState; savedAt: number }> {
    const { startRun } = await import('@/domain/runEngine');
    const { state } = startRun({ runId: 'old-run', config: FREE, planLabel: null, now: T0 - 720_000 });
    return { state, savedAt: T0 - 600_000 };
  }

  it('끝나지 않은 러닝이 없으면 null', async () => {
    const { controller } = await setup();
    expect(await controller.checkPendingRun()).toBeNull();
  });

  it('위치 받기가 꺼져 있으면 저장된 시각까지의 값으로 "이어서 / 여기까지 저장"을 묻게 한다', async () => {
    const { controller, repo } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());

    const pending = await controller.checkPendingRun();

    // 앱이 꺼져 있던 10분은 경과 시간에 넣지 않는다
    expect(pending).toEqual({ stillRunning: false, elapsedMs: 120_000, distanceM: 0 });
  });

  it('방금까지 저장되고 있었고 위치 받기도 돌고 있으면 화면만 다시 붙인다', async () => {
    const { controller, repo, location, useRunStore } = await setup();
    const saved = await savedRun();
    repo.loadActiveRun.mockResolvedValue({ ...saved, savedAt: T0 - 2000 });
    location.isLocationRunning.mockResolvedValue(true);

    const pending = await controller.checkPendingRun();

    expect(pending?.stillRunning).toBe(true);
    expect(useRunStore.getState().run?.runId).toBe('old-run');
    expect(location.startLocationUpdates).not.toHaveBeenCalled();
  });

  it('화면을 다시 붙일 때 잠금화면 버튼과 음성도 다시 붙인다', async () => {
    const { controller, repo, location, notification, voice, useRunStore } = await setup();
    const saved = await savedRun();
    repo.loadActiveRun.mockResolvedValue({ ...saved, savedAt: T0 - 2000 });
    location.isLocationRunning.mockResolvedValue(true);

    await controller.checkPendingRun();

    expect(notification.startRunControl).toHaveBeenCalledTimes(1);
    expect(notification.startRunControl.mock.calls[0][1]).toBe(false);
    expect(voice.prepareVoice).toHaveBeenCalledWith('duck');

    // 다시 붙은 버튼으로 일시정지가 된다
    notification.startRunControl.mock.calls[0][0].onPause();
    await flush();
    expect(useRunStore.getState().run?.status).toBe('paused');
  });

  it('러닝이 없는데 위치 받기 · 조작 알림만 남아 있으면 끄고, 복구할 수 없는 진행 중 러닝은 닫는다', async () => {
    const { controller, repo, location, notification } = await setup();

    expect(await controller.checkPendingRun()).toBeNull();

    expect(location.stopLocationUpdates).toHaveBeenCalledTimes(1);
    expect(notification.stopRunControl).toHaveBeenCalledTimes(1);
    expect(repo.closeOrphanRuns).toHaveBeenCalledTimes(1);
  });

  it('남은 것을 끄는 사이 새 러닝이 시작되면, 방금 만든 러닝을 "남은 러닝"으로 닫지 않는다', async () => {
    const { controller, repo, location } = await setup();
    // 위치 끄기가 오래 걸리는 동안 사용자가 시작을 누른다
    let finishStopping: () => void = () => {};
    location.stopLocationUpdates.mockReturnValueOnce(new Promise<void>((resolve) => (finishStopping = resolve)));

    const checking = controller.checkPendingRun();
    await flush();
    const started = await controller.startRunSession(FREE, null);
    expect(started.ok).toBe(true);

    finishStopping();
    const pending = await checking;

    expect(repo.closeOrphanRuns).not.toHaveBeenCalled();
    expect(pending).toMatchObject({ stillRunning: true });
  });

  it('남은 러닝을 닫지 못해도 홈은 그대로 쓸 수 있다', async () => {
    const { controller, repo } = await setup();
    repo.closeOrphanRuns.mockRejectedValue(new Error('disk'));

    await expect(controller.checkPendingRun()).resolves.toBeNull();
  });

  it('끝나지 않은 러닝이 남아 있으면 새 러닝을 시작하지 않는다(복구 상태를 덮어쓰지 않는다)', async () => {
    const { controller, repo } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());

    const result = await controller.startRunSession(FREE, null);

    expect(result).toEqual({ ok: false, reason: 'already-running' });
    expect(repo.insertRun).not.toHaveBeenCalled();
  });

  it('위치 작업 등록은 남아 있어도 저장이 한참 끊겨 있었으면, 이어 가지 않고 물어보게 한다', async () => {
    // 앱이 강제 종료되면 등록은 남지만 기록은 멈춘다. 꺼져 있던 10분을 뛴 시간으로 치면 안 된다.
    const { controller, repo, location, useRunStore } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());
    location.isLocationRunning.mockResolvedValue(true);

    const pending = await controller.checkPendingRun();

    expect(pending).toEqual({ stillRunning: false, elapsedMs: 120_000, distanceM: 0 });
    expect(location.stopLocationUpdates).toHaveBeenCalled();
    expect(useRunStore.getState().run).toBeNull();
  });

  it('기록이 끊겨 있었으면 밀어서 지울 수 없는 잠금화면 조작 알림도 지운다', async () => {
    const { controller, repo, notification } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());

    await controller.checkPendingRun();

    expect(notification.stopRunControl).toHaveBeenCalledTimes(1);
  });

  it('[이어서]: 위치 받기를 다시 켜고, 꺼져 있던 시간을 뺀 채로 이어 간다', async () => {
    const { controller, repo, location, useRunStore } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());

    expect(await controller.continuePendingRun()).toBe(true);

    expect(location.startLocationUpdates).toHaveBeenCalledTimes(1);
    const run = useRunStore.getState().run;
    expect(run).toMatchObject({ runId: 'old-run', status: 'active', pausedTotalMs: 600_000 });
  });

  it('[이어서]인데 위치를 켜지 못하면 false를 돌려주고 저장된 러닝은 그대로 둔다', async () => {
    const { controller, repo, location, useRunStore } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());
    location.startLocationUpdates.mockRejectedValue(new Error('permission'));

    expect(await controller.continuePendingRun()).toBe(false);
    expect(useRunStore.getState().run).toBeNull();
    expect(repo.saveFinishedRun).not.toHaveBeenCalled();
  });

  it('[여기까지 저장]: 마지막 저장 시각까지를 한 번의 러닝으로 닫는다', async () => {
    const { controller, repo } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());

    const summary = await controller.savePendingRun();

    expect(summary).toMatchObject({ runId: 'old-run', elapsedMs: 120_000, endedAt: T0 - 600_000 });
    expect(repo.saveFinishedRun).toHaveBeenCalledTimes(1);
  });

  it('[여기까지 저장]이 끝나면 남아 있던 위치 받기 · 조작 알림을 끈다', async () => {
    const { controller, repo, location, notification } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());

    await controller.savePendingRun();

    expect(location.stopLocationUpdates).toHaveBeenCalled();
    expect(notification.stopRunControl).toHaveBeenCalled();
  });

  it('[여기까지 저장]이 실패하면 null을 돌려주고 러닝은 DB에 그대로 남는다', async () => {
    const { controller, repo } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());
    repo.saveFinishedRun.mockRejectedValue(new Error('disk'));

    expect(await controller.savePendingRun()).toBeNull();
    expect(repo.deleteRun).not.toHaveBeenCalled();
  });

  it('화면 없이 프로세스만 다시 살아나 위치가 들어오면, 저장된 상태를 되살려 이어서 계산한다', async () => {
    const { repo, notification, voice, useRunStore, sendLocations } = await setup();
    const { startRun } = await import('@/domain/runEngine');
    repo.loadActiveRun.mockResolvedValue({
      state: startRun({ runId: 'old-run', config: FREE, planLabel: null, now: T0 - 60_000 }).state,
      savedAt: T0 - 1000,
    });

    sendLocations([fixAt(0, 0)]);
    await flush();

    expect(useRunStore.getState().run?.runId).toBe('old-run');
    expect(repo.saveProgress).toHaveBeenCalled();
    // 잠금화면 버튼과 음성도 다시 붙는다
    expect(notification.startRunControl).toHaveBeenCalledTimes(1);
    expect(voice.prepareVoice).toHaveBeenCalledTimes(1);
  });

  it('되살리는 사이 위치가 연달아 와도 되살리기는 한 번만 한다', async () => {
    const { repo, sendLocations } = await setup();
    const { startRun } = await import('@/domain/runEngine');
    repo.loadActiveRun.mockResolvedValue({
      state: startRun({ runId: 'old-run', config: FREE, planLabel: null, now: T0 - 60_000 }).state,
      savedAt: T0 - 1000,
    });

    sendLocations([fixAt(0, 0)]);
    sendLocations([fixAt(1, 3)]);
    sendLocations([fixAt(2, 6)]);
    await flush();

    expect(repo.loadActiveRun).toHaveBeenCalledTimes(1);
  });

  it('한참 끊겨 있다가 위치만 다시 들어오면, 이어 가지 않고 위치 받기를 끈다(물어볼 러닝은 DB에 남긴다)', async () => {
    const { repo, location, useRunStore, sendLocations } = await setup();
    repo.loadActiveRun.mockResolvedValue(await savedRun());

    sendLocations([fixAt(0, 0)]);
    await flush();

    expect(useRunStore.getState().run).toBeNull();
    expect(location.stopLocationUpdates).toHaveBeenCalledTimes(1);
    expect(repo.saveProgress).not.toHaveBeenCalled();
    expect(repo.saveFinishedRun).not.toHaveBeenCalled();
  });

  it('홈이 확인하는 사이 위치가 들어와 먼저 되살아났으면, 옛 상태로 덮어쓰지 않는다', async () => {
    const { controller, repo, location, useRunStore, sendLocations } = await setup();
    const { startRun } = await import('@/domain/runEngine');
    repo.loadActiveRun.mockResolvedValue({
      state: startRun({ runId: 'old-run', config: FREE, planLabel: null, now: T0 - 60_000 }).state,
      savedAt: T0 - 1000,
    });
    // 홈의 확인이 "위치 받기가 돌고 있나"를 기다리는 동안 위치가 들어온다
    let answer: (running: boolean) => void = () => {};
    location.isLocationRunning.mockImplementationOnce(() => new Promise<boolean>((resolve) => (answer = resolve)));

    const checking = controller.checkPendingRun();
    await flush();
    sendLocations([fixAt(1, 0)]);
    sendLocations([fixAt(2, 3)]);
    await flush();
    const distanceAfterRestore = useRunStore.getState().run?.distanceM;
    answer(true);
    const pending = await checking;

    expect(pending?.stillRunning).toBe(true);
    expect(useRunStore.getState().run?.distanceM).toBe(distanceAfterRestore);
  });

  it('되살릴 러닝이 없는데 위치만 들어오면 위치 받기를 끈다', async () => {
    const { location, sendLocations } = await setup();

    sendLocations([fixAt(0, 0)]);
    await flush();

    expect(location.stopLocationUpdates).toHaveBeenCalledTimes(1);
  });
});
