import { expect, it } from 'vitest';
import { canSelectLocalMusic, fitsLocalMusicBudget } from './localMusicFile';

it('rejects an empty music file before Web Audio decoding', () => {
  expect(
    canSelectLocalMusic({ name: 'empty.wav', size: 0, type: 'audio/wav' }),
  ).toBe(false);
});
it('allows an audio file exactly at the file-size boundary', () => {
  expect(
    canSelectLocalMusic({
      name: 'limit.MP3',
      size: 25 * 1024 * 1024,
      type: 'audio/mpeg',
    }),
  ).toBe(true);
});
it('rejects files greater than the input byte budget', () => {
  expect(
    canSelectLocalMusic({
      name: 'long.wav',
      size: 25 * 1024 * 1024 + 1,
      type: 'audio/wav',
    }),
  ).toBe(false);
});
it('allows the MP4 MIME reported for an M4A audio container', () => {
  expect(
    canSelectLocalMusic({ name: 'song.m4a', size: 1200, type: 'video/mp4' }),
  ).toBe(true);
});
it('permits AAC with an unspecified MIME for browser decoding', () => {
  expect(canSelectLocalMusic({ name: 'song.aac', size: 1200, type: '' })).toBe(
    true,
  );
});
it('rejects an HTML file renamed to a supported audio extension', () => {
  expect(
    canSelectLocalMusic({ name: 'renamed.mp3', size: 1200, type: 'text/html' }),
  ).toBe(false);
});
it('rejects an audio MIME paired with an unsupported extension', () => {
  expect(
    canSelectLocalMusic({ name: 'song.flac', size: 1200, type: 'audio/flac' }),
  ).toBe(false);
});
it('rejects mismatched explicit audio MIME and extension', () => {
  expect(
    canSelectLocalMusic({
      name: 'renamed.wav',
      size: 1200,
      type: 'audio/mpeg',
    }),
  ).toBe(false);
});
it('keeps compressed audio with excessive decoded duration out of the stream', () => {
  expect(
    fitsLocalMusicBudget({
      duration: 1200.01,
      length: 19_000_000,
      numberOfChannels: 1,
    }),
  ).toBe(false);
});
it('rejects decoded audio above the stereo sample budget despite a short duration', () => {
  expect(
    fitsLocalMusicBudget({
      duration: 400,
      length: 19_200_000,
      numberOfChannels: 2,
    }),
  ).toBe(false);
});
it('rejects multichannel source files from the stereo playback pipeline', () => {
  expect(
    fitsLocalMusicBudget({
      duration: 45,
      length: 2_160_000,
      numberOfChannels: 6,
    }),
  ).toBe(false);
});
