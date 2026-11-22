"""앱에 넣는 소리 파일을 만든다. (실행: python scripts/make_audio.py)

- silence.wav: 음성 안내 동안 음악 볼륨을 낮추려고 잠깐 트는 무음(1초).
- metronome_<분당 걸음 수>.wav: 발걸음 박자. 한 박자 길이만큼의 파일이라 반복 재생하면 박자가 된다.
  박자를 JS 타이머로 맞추면 화면이 꺼졌을 때 밀리므로, 길이가 정확한 파일을 반복 재생한다(pacerun-design.md 0-6).
"""
import math
import struct
import sys
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "audio"
SPM_VALUES = range(150, 191, 5)  # 150, 155, … 190


def write(name: str, samples: list[int]) -> None:
    with wave.open(str(OUT / name), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b"".join(struct.pack("<h", s) for s in samples))


def click(total_frames: int) -> list[int]:
    """앞부분 30ms에 짧은 '틱' 소리(1kHz, 빠르게 줄어듦), 나머지는 무음."""
    samples = [0] * total_frames
    tick = int(RATE * 0.03)
    for i in range(min(tick, total_frames)):
        envelope = math.exp(-i / (RATE * 0.006))
        samples[i] = int(0.8 * 32767 * envelope * math.sin(2 * math.pi * 1000 * i / RATE))
    return samples


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    write("silence.wav", [0] * RATE)
    for spm in SPM_VALUES:
        write(f"metronome_{spm}.wav", click(round(RATE * 60 / spm)))
    print(f"{len(list(OUT.glob('*.wav')))}개 파일을 {OUT}에 만들었어요")
    return 0


if __name__ == "__main__":
    sys.exit(main())
