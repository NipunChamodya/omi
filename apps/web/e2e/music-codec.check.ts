import { expect, test } from '@playwright/test';

async function musicSettings(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Your name').fill('Music host');
  await page.getByRole('button', { name: 'Create a table' }).click();
  await page.getByRole('button', { name: 'Sound, voice & music' }).click();
  const music = page.getByRole('region', { name: 'Local table music' });
  await music.getByText('Local table music', { exact: true }).click();
  return music;
}

test('local codec MP3 decodes and opens host sharing without microphone permission', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new Error('Music must not open a microphone'));
  });
  const music = await musicSettings(page);
  await music
    .getByLabel('Choose a music file')
    .setInputFiles('apps/web/src/social/assets/coast-v1.mp3');
  await music.getByLabel('I have permission to share this audio.').check();
  await music.getByRole('button', { name: 'Start sharing file' }).click();
  await expect(music.getByRole('status')).toHaveText('File sharing connected');
  await music.getByRole('button', { name: 'Play file', exact: true }).click();
  const position = music.getByRole('slider', {
    name: 'File playback position',
  });
  await expect
    .poll(async () => Number(await position.inputValue()))
    .toBeGreaterThan(0);
  await music.getByRole('button', { name: 'Stop file sharing' }).click();
  await expect(music.getByRole('status')).toHaveText('File audio off');
});

test('local codec rejects unreadable AAC before opening the music signaling connection', async ({
  page,
}) => {
  let offered = false;
  page.on('websocket', (socket) => {
    if (socket.url().endsWith('/music/ws')) offered = true;
  });
  const music = await musicSettings(page);
  await music.getByLabel('Choose a music file').setInputFiles({
    name: 'corrupt.aac',
    mimeType: 'audio/aac',
    buffer: Buffer.from('This fixture contains no audio frames.'),
  });
  await music.getByLabel('I have permission to share this audio.').check();
  await music.getByRole('button', { name: 'Start sharing file' }).click();
  await expect(music.getByRole('alert')).toHaveText(
    'File audio could not connect or play.',
  );
  await expect(music.getByRole('status')).toHaveText('File audio off');
  expect(offered).toBe(false);
});
