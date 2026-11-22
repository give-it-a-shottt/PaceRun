/**
 * 발걸음 박자(메트로놈). 한 박자 길이의 소리 파일을 반복 재생한다.
 * 박자를 JS 타이머로 맞추면 화면이 꺼졌을 때 밀리므로, 길이가 정확한 파일을 오디오 쪽에서 반복시킨다
 * (pacerun-design.md 0-6). 파일은 app/scripts/make_audio.py가 만든다(분당 150~190걸음, 5 단위).
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { nearestCadence } from '@/domain/runConfig';

import { disposePlayer } from './audioPlayers';

// Metro는 require의 경로를 빌드 때 알아야 해서, 파일마다 하나씩 적는다
const SOUNDS: Record<number, number> = {
  150: require('@/assets/audio/metronome_150.wav'),
  155: require('@/assets/audio/metronome_155.wav'),
  160: require('@/assets/audio/metronome_160.wav'),
  165: require('@/assets/audio/metronome_165.wav'),
  170: require('@/assets/audio/metronome_170.wav'),
  175: require('@/assets/audio/metronome_175.wav'),
  180: require('@/assets/audio/metronome_180.wav'),
  185: require('@/assets/audio/metronome_185.wav'),
  190: require('@/assets/audio/metronome_190.wav'),
};

let player: AudioPlayer | null = null;
let playingSpm: number | null = null;

/** 박자 소리를 켠다. 이미 같은 박자로 울리고 있으면 그대로 둔다. 소리를 못 내도 러닝은 계속돼야 해서 오류를 삼킨다. */
export function startMetronome(spm: number): void {
  const target = nearestCadence(spm);
  try {
    if (!player || playingSpm !== target) {
      disposePlayer(player);
      player = createAudioPlayer(SOUNDS[target]);
      player.loop = true;
      playingSpm = target;
    }
    player.play();
  } catch (error) {
    console.warn('[metronome] 박자 소리를 켜지 못했어요', error);
  }
}

/** 박자 소리를 끄고 플레이어를 정리한다(일시정지 · 종료). 켜져 있지 않아도 불러도 된다. */
export function stopMetronome(): void {
  disposePlayer(player);
  player = null;
  playingSpm = null;
}
