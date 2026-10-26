// Deterministic synthetic input for Chromium's native fake microphone device.
// No recorded speech or user audio is read or written.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../scripts/config.mjs';
const directory = join(root, '.remote-testing');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const rate = 48_000;
const seconds = 8;
const samples = rate * seconds;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
let phase = 0;
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  phase += (2 * Math.PI * (170 + 35 * Math.sin(2 * Math.PI * 0.7 * t))) / rate;
  const envelope = 0.65 + 0.35 * Math.sin(2 * Math.PI * 2.3 * t);
  const value =
    0.22 *
    envelope *
    (Math.sin(phase) + 0.4 * Math.sin(3 * phase) + 0.2 * Math.sin(5 * phase));
  wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}
export const syntheticAudioPath = join(directory, 'synthetic-voice.wav');
writeFileSync(syntheticAudioPath, wav, { mode: 0o600 });
