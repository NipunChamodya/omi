# Original OMI table foley

All eight MP3 files in this folder were synthesized specifically for this project by `infra/scripts/generate-card-audio.py`. They contain deterministic generated noise envelopes, paper-like impulses, low wooden resonances and simple mallet tones. No commercial game audio, recordings, third-party samples or model-generated audio were used. They may be used and modified as OMI project assets; there is no third-party attribution requirement.

Regenerate from repository root with `python3 infra/scripts/generate-card-audio.py` (Python standard library and an installed ffmpeg). Output is mono, 22.05 kHz, 48 kbit/s MP3, with source metadata removed. Combined encoded payload is approximately 21 KB. Vite emits separate same-origin hashed files; they are deliberately not inlined or precached by the service worker. Playback lazily fetches, decodes and reuses each buffer.

`shuffle.mp3` contains gather/split/interleaving impulses and a finishing deck tap. Other cues use separate assets or gentle pitch/gain variants. Dragging has no continuous sound; ambience is a very quiet optional loop, off by default.
