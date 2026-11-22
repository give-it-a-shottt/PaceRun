/**
 * 음성 안내. 안내하는 동안만 음악 볼륨을 낮추고, 끝나면 되돌린다(pacerun-design.md P4).
 *
 * 안드로이드에서 expo-speech는 다른 앱의 소리를 낮춰 달라고 요청하지 않는다. 그래서
 * expo-audio로 "무음 파일"을 잠깐 틀어 낮추기(duck)를 요청하고, 말이 끝나면 멈춰서 음악 볼륨이 돌아오게 한다.
 * 실제로 볼륨이 낮아졌다 돌아오는지는 실기기에서 확인해야 한다(STATUS "내가 할 일").
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';

/** duck = 안내 동안 음악을 낮춘다 / mix = 낮추지 않고 섞는다(메트로놈이 계속 울리는 케이던스 모드) */
export type VoiceMixing = 'duck' | 'mix';

const VOICE_LANGUAGE = 'ko-KR';

let mixing: VoiceMixing = 'duck';
let duckPlayer: AudioPlayer | null = null;
/** 아직 다 말하지 않은 안내 수. 0이 되면 음악 볼륨을 되돌린다. */
let pending = 0;

/** 러닝을 시작할 때 한 번 부른다. 실패해도 러닝은 계속돼야 하므로 오류를 던지지 않는다. */
export async function prepareVoice(next: VoiceMixing): Promise<void> {
  mixing = next;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: next === 'duck' ? 'duckOthers' : 'mixWithOthers',
    });
  } catch (error) {
    console.warn('[voice] 오디오 모드를 설정하지 못했어요', error);
  }
}

export function say(text: string): void {
  pending += 1;
  if (mixing === 'duck') startDucking();

  let finished = false;
  const done = () => {
    // 완료 · 중단 · 오류 콜백이 겹쳐 불려도 한 번만 센다
    if (finished) return;
    finished = true;
    pending = Math.max(0, pending - 1);
    if (pending === 0) stopDucking();
  };

  Speech.speak(text, { language: VOICE_LANGUAGE, onDone: done, onStopped: done, onError: done });
}

/** 러닝이 끝나면 부른다. 말하던 안내를 멈추고 음악 볼륨을 되돌린다. */
export async function releaseVoice(): Promise<void> {
  pending = 0;
  try {
    await Speech.stop();
  } catch (error) {
    console.warn('[voice] 음성을 멈추지 못했어요', error);
  }
  stopDucking();
  duckPlayer?.remove();
  duckPlayer = null;
}

function startDucking(): void {
  try {
    if (!duckPlayer) {
      duckPlayer = createAudioPlayer(require('@/assets/audio/silence.wav'));
      duckPlayer.loop = true;
    }
    duckPlayer.play();
  } catch (error) {
    // 볼륨을 못 낮춰도 안내는 그대로 말한다
    console.warn('[voice] 음악 볼륨을 낮추지 못했어요', error);
  }
}

function stopDucking(): void {
  try {
    duckPlayer?.pause();
  } catch (error) {
    console.warn('[voice] 음악 볼륨을 되돌리지 못했어요', error);
  }
}
