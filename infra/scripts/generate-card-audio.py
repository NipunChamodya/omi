"""Original deterministic OMI foley; no recordings or third-party samples.
Requires ffmpeg for compact mono MP3 output. Regenerate from repository root.
"""
import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

DEST = Path('apps/web/src/audio/assets')
DEST.mkdir(parents=True, exist_ok=True)
RATE = 22050
for index, (name, duration) in enumerate([
    ('paper', .12), ('slide', .24), ('land', .19), ('flick', .1),
    ('shuffle', .9), ('gather', .32), ('tone', .18), ('result', .55),
]):
    rng = random.Random(1600 + index)
    samples = []
    low = 0.0
    for i in range(round(RATE * duration)):
        t = i / RATE
        noise = rng.uniform(-1, 1)
        low = .78 * low + .22 * noise
        envelope = min(1, t / .008) * math.exp(-t / (duration / 3))
        if name in ('tone', 'result'):
            # Warm, brief mallet voicing, not an attention-grabbing alarm.
            notes = (523.25, 659.25, 783.99) if name == 'result' else (660,)
            value = sum(math.sin(2 * math.pi * hz * t) for hz in notes) / len(notes)
            value *= .32 * envelope
        elif name == 'land':
            value = (low * .7 + math.sin(2 * math.pi * 145 * t) * .3) * envelope
        elif name == 'shuffle':
            # Short overlapping paper impulses followed by a wooden deck tap.
            pulse = sum(math.exp(-(t - onset) / .018) for onset in
                        [0, .09, .2, .26, .3, .34, .38, .42, .46, .5, .54, .65]
                        if t >= onset)
            value = (noise - low) * .2 * pulse
            if t > .76:
                value += .25 * math.sin(2 * math.pi * 140 * t) * math.exp(-(t - .76) / .025)
        else:
            value = (noise - low * .8) * envelope * .45
            if name == 'gather':
                value *= .5 + .5 * math.sin(2 * math.pi * 27 * t) ** 2
        samples.append(struct.pack('<h', round(max(-.85, min(.85, value)) * 32767)))
    with tempfile.TemporaryDirectory(prefix='omi-card-audio-') as folder:
        source = Path(folder) / 'original.wav'
        with wave.open(str(source), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(b''.join(samples))
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-i', str(source), '-map_metadata', '-1', '-b:a', '48k',
                        str(DEST / f'{name}.mp3')], check=True)
