# Native OMI audio

- `coastal-breeze.wav` adapts the original OMI track `apps/web/src/social/assets/coast-v1.mp3`. The source decodes to 22,050 Hz mono PCM. Its final and initial 22,050 samples are summed, followed by the middle samples, to overlap the existing one-second fades on the beat. The resulting 16-bit PCM loop is 31 seconds and has no MP3 encoder padding.
- `chime.wav` is the original OMI `apps/web/src/social/assets/chime-v1.wav`, used for the explicit sound-effects preview.

Both originals are CC0 1.0. See `apps/web/src/social/assets/LICENSE.md` and `infra/scripts/generate-social-audio.py`.
