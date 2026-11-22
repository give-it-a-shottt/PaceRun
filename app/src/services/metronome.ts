/**
 * 발걸음 박자(메트로놈). 한 박자 길이의 소리 파일을 반복 재생한다.
 * 박자를 JS 타이머로 맞추면 화면이 꺼졌을 때 밀리므로, 길이가 정확한 파일을 오디오 쪽에서 반복시킨다
 * (pacerun-design.md 0-6). 파일은 app/scripts/make_audio.py가 만든다(분당 150~190걸음, 5 단위).
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { nearestCadence } from '@/domain/runConfig';

import { disposePlayer } from './audioPlayers';
import { METRONOME_SOUNDS } from './sounds';

let player: AudioPlayer | null = null;
let playingSpm: number | null = null;

/**
 * 박자 소리를 켠다. 이미 같은 박자로 울리고 있으면 그대로 둔다.
 * 소리를 못 내도 러닝은 계속돼야 해서 오류를 던지지 않고, 켰는지를 돌려준다.
 */
export function startMetronome(spm: number): boolean {
  const target = nearestCadence(spm);
  try {
    if (!player || playingSpm !== target) {
      disposePlayer(player);
      // 새로 만들다 실패해도 이미 정리한 플레이어를 가리키지 않게 먼저 비운다
      player = null;
      playingSpm = null;
      const created = createAudioPlayer(METRONOME_SOUNDS[target]);
      created.loop = true;
      player = created;
      playingSpm = target;
    }
    player.play();
    return true;
  } catch (error) {
    console.warn('[metronome] 박자 소리를 켜지 못했어요', error);
    return false;
  }
}

/** 박자 소리를 끄고 플레이어를 정리한다(일시정지 · 종료). 켜져 있지 않아도 불러도 된다. */
export function stopMetronome(): void {
  disposePlayer(player);
  player = null;
  playingSpm = null;
}
