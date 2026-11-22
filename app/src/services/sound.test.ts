import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 소리 재생기와 음성 엔진을 가짜로 바꿔, "소리를 못 내도 러닝은 계속된다"는 약속을 확인한다:
// 오류를 밖으로 던지지 않는지, 재생기를 남기지 않는지, 음악 볼륨을 낮춘 채로 두지 않는지.
vi.mock('expo-audio', () => ({ createAudioPlayer: vi.fn(), setAudioModeAsync: vi.fn() }));
vi.mock('expo-speech', () => ({ speak: vi.fn(), stop: vi.fn() }));
// 실제 목록은 소리 파일을 require한다(테스트 환경에서는 읽을 수 없다)
vi.mock('./sounds', () => ({
  METRONOME_SOUNDS: { 150: 150, 155: 155, 160: 160, 165: 165, 170: 170, 175: 175, 180: 180, 185: 185, 190: 190 },
  SILENCE_SOUND: 1,
}));

type FakePlayer = {
  loop: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

function fakePlayer(): FakePlayer {
  return { loop: false, play: vi.fn(), pause: vi.fn(), remove: vi.fn(), release: vi.fn() };
}

/** 모듈 안에 상태(재생기 · 말하는 중인 안내 수)를 들고 있으므로 테스트마다 새로 불러온다. */
async function setup() {
  vi.resetModules();
  const audio = vi.mocked(await import('expo-audio'));
  const speech = vi.mocked(await import('expo-speech'));
  // 앞 테스트가 바꿔 둔 동작(예: 던지게 만든 speak)이 남지 않게 호출 기록과 동작을 모두 지운다
  for (const mock of [audio.createAudioPlayer, audio.setAudioModeAsync, speech.speak, speech.stop]) mock.mockReset();

  const players: FakePlayer[] = [];
  audio.createAudioPlayer.mockImplementation(() => {
    const player = fakePlayer();
    players.push(player);
    return player as never;
  });
  audio.setAudioModeAsync.mockResolvedValue(undefined);
  speech.stop.mockResolvedValue(undefined);

  const metronome = await import('./metronome');
  const voice = await import('./voice');
  const { disposePlayer } = await import('./audioPlayers');
  return { audio, speech, players, metronome, voice, disposePlayer };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('발걸음 박자 소리', () => {
  it('박자에 맞는 파일을 반복 재생한다', async () => {
    const { audio, players, metronome } = await setup();

    expect(metronome.startMetronome(170)).toBe(true);

    expect(audio.createAudioPlayer).toHaveBeenCalledWith(170);
    expect(players[0].loop).toBe(true);
    expect(players[0].play).toHaveBeenCalledTimes(1);
  });

  it('파일이 없는 걸음 수는 가장 가까운 5 단위 박자로 맞춘다', async () => {
    const { audio, metronome } = await setup();
    metronome.startMetronome(172);
    expect(audio.createAudioPlayer).toHaveBeenCalledWith(170);
    metronome.stopMetronome();
    metronome.startMetronome(230);
    expect(audio.createAudioPlayer).toHaveBeenLastCalledWith(190);
  });

  it('같은 박자로 다시 켜면 재생기를 새로 만들지 않는다', async () => {
    const { audio, players, metronome } = await setup();
    metronome.startMetronome(170);
    metronome.startMetronome(170);
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(players[0].play).toHaveBeenCalledTimes(2);
  });

  it('끄면 재생기를 멈추고 바로 놓아 준다', async () => {
    const { players, metronome } = await setup();
    metronome.startMetronome(170);

    metronome.stopMetronome();

    expect(players[0].pause).toHaveBeenCalled();
    expect(players[0].remove).toHaveBeenCalled();
    expect(players[0].release).toHaveBeenCalled();
  });

  it('껐다 켜면 새 재생기를 만든다(놓아 준 재생기를 다시 쓰지 않는다)', async () => {
    const { audio, players, metronome } = await setup();
    metronome.startMetronome(170);
    metronome.stopMetronome();
    metronome.startMetronome(170);
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(2);
    expect(players[1].play).toHaveBeenCalledTimes(1);
  });

  it('켜져 있지 않아도 꺼도 된다', async () => {
    const { metronome } = await setup();
    expect(() => metronome.stopMetronome()).not.toThrow();
  });

  it('재생기를 만들지 못하면 오류를 던지지 않고 false를 돌려준다', async () => {
    const { audio, metronome } = await setup();
    audio.createAudioPlayer.mockImplementation(() => {
      throw new Error('no audio');
    });
    expect(metronome.startMetronome(170)).toBe(false);
  });

  it('박자를 바꾸다 실패하면 놓아 준 옛 재생기를 붙들고 있지 않는다', async () => {
    const { audio, players, metronome } = await setup();
    metronome.startMetronome(170);
    audio.createAudioPlayer.mockImplementationOnce(() => {
      throw new Error('no audio');
    });

    expect(metronome.startMetronome(180)).toBe(false);
    expect(players[0].release).toHaveBeenCalled();

    // 다시 켜면 놓아 준 재생기의 play()를 부르지 않고 새로 만든다
    expect(metronome.startMetronome(170)).toBe(true);
    expect(players[0].play).toHaveBeenCalledTimes(1);
    expect(players).toHaveLength(2);
  });

  it('재생이 실패해도 오류를 던지지 않는다', async () => {
    const { audio, metronome } = await setup();
    const broken = fakePlayer();
    broken.play.mockImplementation(() => {
      throw new Error('play failed');
    });
    audio.createAudioPlayer.mockReturnValue(broken as never);
    expect(metronome.startMetronome(170)).toBe(false);
  });
});

describe('재생기 정리', () => {
  it('정리하다 오류가 나도 던지지 않는다', async () => {
    const { disposePlayer } = await setup();
    const broken = fakePlayer();
    broken.remove.mockImplementation(() => {
      throw new Error('already removed');
    });
    expect(() => disposePlayer(broken as never)).not.toThrow();
    expect(() => disposePlayer(null)).not.toThrow();
  });
});

describe('음성 안내와 음악 볼륨', () => {
  /** 마지막 speak 호출에 넘긴 콜백들 */
  function callbacks(speech: { speak: { mock: { calls: unknown[][] } } }) {
    return speech.speak.mock.calls.at(-1)?.[1] as { onDone: () => void; onStopped: () => void; onError: () => void };
  }

  it('말하는 동안 무음 재생기를 틀어 음악을 낮추고, 다 말하면 멈춘다', async () => {
    const { speech, players, voice } = await setup();
    await voice.prepareVoice('duck');

    voice.say('달리기. 1분');
    expect(speech.speak).toHaveBeenCalledWith('달리기. 1분', expect.objectContaining({ language: 'ko-KR' }));
    expect(players[0].play).toHaveBeenCalledTimes(1);
    expect(players[0].pause).not.toHaveBeenCalled();

    callbacks(speech).onDone();
    expect(players[0].pause).toHaveBeenCalledTimes(1);
  });

  it('안내가 겹치면 마지막 안내가 끝날 때 볼륨을 되돌린다', async () => {
    const { speech, players, voice } = await setup();
    await voice.prepareVoice('duck');
    voice.say('오늘 1회 인정!');
    const first = callbacks(speech);
    voice.say('1킬로미터');
    const second = callbacks(speech);

    first.onDone();
    expect(players[0].pause).not.toHaveBeenCalled();
    second.onDone();
    expect(players[0].pause).toHaveBeenCalledTimes(1);
  });

  it('발걸음 박자 모드(섞기)에서는 음악을 낮추지 않는다', async () => {
    const { audio, voice } = await setup();
    await voice.prepareVoice('mix');
    voice.say('5분. 0.9킬로미터');
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ interruptionMode: 'mixWithOthers' }));
  });

  it('말하기가 오류를 던져도 밖으로 던지지 않고 볼륨을 되돌린다', async () => {
    const { speech, players, voice } = await setup();
    await voice.prepareVoice('duck');
    speech.speak.mockImplementation(() => {
      throw new Error('no tts');
    });

    expect(() => voice.say('달리기. 1분')).not.toThrow();
    expect(players[0].pause).toHaveBeenCalledTimes(1);
  });

  it('다 말했다는 신호가 15초 안에 오지 않으면 끝난 것으로 보고 볼륨을 되돌린다', async () => {
    const { players, voice } = await setup();
    await voice.prepareVoice('duck');
    voice.say('달리기. 1분');

    vi.advanceTimersByTime(14_999);
    expect(players[0].pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(players[0].pause).toHaveBeenCalledTimes(1);
  });

  it('신호가 여러 번 와도(완료 뒤 시간 초과 등) 한 번만 센다', async () => {
    const { speech, players, voice } = await setup();
    await voice.prepareVoice('duck');
    voice.say('첫 안내');
    const first = callbacks(speech);
    voice.say('둘째 안내');

    first.onDone();
    first.onStopped();
    vi.advanceTimersByTime(1_000);
    // 둘째 안내가 아직 말하는 중이므로 볼륨은 낮춘 채여야 한다
    expect(players[0].pause).not.toHaveBeenCalled();
  });

  it('무음 재생기를 만들지 못해도 안내는 말한다', async () => {
    const { audio, speech, voice } = await setup();
    await voice.prepareVoice('duck');
    audio.createAudioPlayer.mockImplementation(() => {
      throw new Error('no audio');
    });

    expect(() => voice.say('달리기. 1분')).not.toThrow();
    expect(speech.speak).toHaveBeenCalledTimes(1);
  });

  it('오디오 모드를 설정하지 못해도 준비는 끝난다', async () => {
    const { audio, voice } = await setup();
    audio.setAudioModeAsync.mockRejectedValue(new Error('denied'));
    await expect(voice.prepareVoice('duck')).resolves.toBeUndefined();
  });

  it('러닝이 끝나면 말하던 것을 멈추고 무음 재생기를 놓아 준다', async () => {
    const { speech, players, voice } = await setup();
    await voice.prepareVoice('duck');
    voice.say('달리기. 1분');

    await voice.releaseVoice();

    expect(speech.stop).toHaveBeenCalled();
    expect(players[0].release).toHaveBeenCalled();
  });

  it('음성을 멈추지 못해도 정리는 끝난다', async () => {
    const { speech, voice } = await setup();
    speech.stop.mockRejectedValue(new Error('busy'));
    await expect(voice.releaseVoice()).resolves.toBeUndefined();
  });
});
