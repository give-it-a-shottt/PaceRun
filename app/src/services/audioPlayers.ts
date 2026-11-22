import type { AudioPlayer } from 'expo-audio';

/**
 * 다 쓴 플레이어를 바로 정리한다.
 * remove()만 부르면 네이티브 플레이어(오디오 트랙)는 JS 쪽 객체가 수거될 때까지 남는다.
 * 러닝 중 일시정지 · 재개를 되풀이하면 그만큼 쌓이므로, release()로 바로 놓아 준다.
 * 정리하다 난 오류는 삼킨다(소리를 못 꺼도 러닝 기록은 이어져야 한다).
 */
export function disposePlayer(player: AudioPlayer | null): void {
  if (!player) return;
  try {
    player.pause();
    player.remove();
    player.release();
  } catch (error) {
    console.warn('[audio] 플레이어를 정리하지 못했어요', error);
  }
}
