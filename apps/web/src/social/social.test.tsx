// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SocialPanel from './SocialPanel';
import { SocialClient, readPreferences } from './client';
import { SocialAudio } from './audio';
const actor = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const clients: SocialClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.stop();
  localStorage.clear();
  vi.restoreAllMocks();
});
it('renders Unicode as text, hides detected adult content by default and blocks incoming messages', () => {
  const client = new SocialClient('room', actor);
  clients.push(client);
  client.store.setState({
    status: 'online',
    history: [
      {
        id: 'message',
        actorId: other,
        text: 'සිංහල <img src=x onerror=alert(1)>',
        adult: false,
        createdAt: 0,
      },
      {
        id: 'adult',
        actorId: other,
        text: 'මගුලයි!',
        adult: true,
        createdAt: 0,
      },
    ],
  });
  render(
    <SocialPanel
      client={client}
      members={[
        {
          actorId: actor,
          displayName: 'Local',
          seat: 0,
          team: 0,
          ready: true,
          connected: true,
        },
        {
          actorId: other,
          displayName: 'Friend',
          seat: 1,
          team: 1,
          ready: true,
          connected: true,
        },
      ]}
    />,
  );
  expect(
    screen.getByText('සිංහල <img src=x onerror=alert(1)>'),
  ).toBeInTheDocument();
  expect(document.querySelector('img')).toBeNull();
  expect(
    screen.getByText('[Adult-language message hidden]'),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByLabelText('Allow adult-language content (off by default)'),
  );
  expect(screen.getAllByText('මගුලයි!').length).toBeGreaterThan(0);
  fireEvent.click(
    screen.getByLabelText(
      'Block incoming chat, reactions and voice from Friend',
    ),
  );
  expect(screen.queryByText('සිංහල <img src=x onerror=alert(1)>')).toBeNull();
});
it('keeps browser preferences bounded and resets tampered values', () => {
  localStorage.setItem(
    'prefs',
    JSON.stringify({
      adult: 'true',
      musicVolume: 8,
      effectsVolume: -1,
      blocked: ['<script>', other],
    }),
  );
  expect(readPreferences('prefs')).toEqual({
    adult: false,
    musicVolume: 0.25,
    effectsVolume: 0.45,
    muteReactions: false,
    blocked: [other],
  });
  localStorage.setItem('prefs', '{');
  expect(readPreferences('prefs').musicVolume).toBe(0.25);
});
it('creates no audio before opt-in and cannot resume a disabled late play promise', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );
  let finish!: () => void;
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
    () =>
      new Promise<void>((done) => {
        finish = done;
      }),
  );
  const audio = new SocialAudio(
    () => 0,
    () => undefined,
    () => undefined,
  );
  audio.update({
    trackId: 'emerald',
    playing: true,
    position: 0,
    updatedAt: 0,
    version: 0,
  });
  expect(document.querySelector('audio')).toBeNull();
  expect(play).not.toHaveBeenCalled();
  const enabling = audio.enableMusic();
  audio.disableMusic();
  finish();
  await enabling;
  expect(audio.musicEnabled).toBe(false);
  expect(document.querySelector('audio')?.getAttribute('src')).toBeNull();
  audio.dispose();
  expect(document.querySelector('audio')).toBeNull();
});

it('does not mistake an offline-cancelled music unlock for an autoplay rejection', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );
  let reject!: (error: unknown) => void;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const errors: (string | null)[] = [];
  const audio = new SocialAudio(
    () => 0,
    (error) => errors.push(error),
    () => undefined,
  );
  audio.setOnline(true);
  audio.update({
    trackId: 'emerald',
    playing: false,
    position: 0,
    updatedAt: 0,
    version: 0,
  });
  const unlocking = audio.enableMusic();
  audio.setOnline(false);
  reject(new DOMException('Interrupted', 'AbortError'));
  await unlocking;
  expect(errors.filter(Boolean)).toHaveLength(0);
  expect(audio.musicEnabled).toBe(true);
  audio.dispose();
});
