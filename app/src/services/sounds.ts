/**
 * 앱에 들어 있는 소리 파일 목록(app/scripts/make_audio.py가 만든다).
 * Metro는 require의 경로를 빌드 때 알아야 해서, 파일마다 하나씩 적는다.
 * 소리 파일을 다루는 코드와 떼어 둔 것은, 테스트에서 이 목록만 가짜로 바꿔 끼우기 위해서다.
 */

/**
 * 발걸음 박자: 분당 걸음 수 → 한 박자 길이의 소리 파일.
 * 걸음 수의 범위 · 간격은 domain/runConfig.ts의 CONFIG_LIMITS.cadenceSpm(150~190, 5씩)과 같아야 한다.
 * 범위를 바꾸면 scripts/make_audio.py로 파일을 만들고 이 목록에 줄을 더한다(없는 박자는 켜지 못했다고 화면에 알린다).
 */
export const METRONOME_SOUNDS: Record<number, number> = {
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

/** 음성 안내 동안 음악 볼륨을 낮추려고 트는 무음 파일(services/voice.ts) */
export const SILENCE_SOUND: number = require('@/assets/audio/silence.wav');
