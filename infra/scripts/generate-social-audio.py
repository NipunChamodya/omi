#!/usr/bin/env python3
"""Generate original CC0 synthetic music/effects; never reads recordings or user audio."""
from pathlib import Path
import math
import struct
import subprocess
import tempfile
import wave
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/web/src/social/assets'
RATE = 22050
OUT.mkdir(parents=True, exist_ok=True)
def write_wav(path, samples):
    maximum = max(max(abs(x) for x in samples), 0.01)
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(RATE)
        audio.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x / maximum * .42)) * 32767)) for x in samples))
def tone(samples, when, length, frequency, level):
    start = int(when * RATE)
    for i in range(int(length * RATE)):
        if start + i >= len(samples): break
        t = i / RATE
        envelope = min(1, t / .012) * math.exp(-2.4 * t) * min(1, (length - t) / .1)
        samples[start + i] += level * envelope * (math.sin(2 * math.pi * frequency * t) + .18 * math.sin(4 * math.pi * frequency * t))
with tempfile.TemporaryDirectory(prefix='omi-original-audio-') as tmp:
    for name, chords in [('emerald', [[220,261.626,329.628],[174.614,220,261.626],[196,261.626,329.628],[196,246.942,293.665]]), ('coast', [[146.832,174.614,220],[196,246.942,293.665],[164.814,196,261.626],[220,261.626,329.628]])]:
        samples = [0.0] * (32 * RATE)
        for beat in range(32):
            chord = chords[beat // 8]
            tone(samples, beat + .05, 2.7, chord[beat % 3] * (2 if beat % 4 == 3 else 1), .14)
            if beat % 4 == 0: tone(samples, beat + .05, 3.8, chord[0] / 2, .08)
        for i in range(RATE):
            samples[i] *= i / RATE
            samples[-i-1] *= i / RATE
        source = Path(tmp) / (name + '.wav'); write_wav(source, samples)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '64k', str(OUT / (name + '-v1.mp3'))], check=True)
        result = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(OUT / (name + '-v1.mp3'))], text=True)
        print(name, 'duration', result.strip())
    for name, duration in [('tap', .12), ('chime', .55), ('chuckle', .48)]:
        samples = []
        for i in range(int(RATE * duration)):
            t = i / RATE
            if name == 'tap': value = math.sin(2 * math.pi * 165 * t) * math.exp(-50 * t) + .3 * math.sin(2 * math.pi * 730 * t) * math.exp(-95 * t)
            elif name == 'chime': value = (math.sin(2 * math.pi * 660 * t) + .35 * math.sin(2 * math.pi * 990 * t)) * math.exp(-9 * t)
            else: value = math.sin(2 * math.pi * (280 * t + 95 * t * t)) * max(0, math.sin(2 * math.pi * 6 * t)) * math.exp(-5 * t)
            samples.append(value * min(1, t / .003) * min(1, (duration - t) / .025))
        write_wav(OUT / (name + '-v1.wav'), samples)
