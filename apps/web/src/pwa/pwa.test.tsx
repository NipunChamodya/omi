// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { readDataSaver, useDataSaver } from './preferences';
import { Avatar } from '../components/Cards';
import { PwaControls } from './PwaControls';
afterEach(() => {
  cleanup();
  localStorage.clear();
  useDataSaver.setState({ enabled: false });
  vi.restoreAllMocks();
});
it('validates persistence and safely handles unavailable storage', () => {
  localStorage.setItem('omi-data-saver', 'garbage');
  expect(readDataSaver()).toBe(false);
  localStorage.setItem('omi-data-saver', 'true');
  expect(readDataSaver()).toBe(true);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  expect(readDataSaver()).toBe(false);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  expect(() => useDataSaver.getState().set(true)).not.toThrow();
  expect(useDataSaver.getState().enabled).toBe(true);
});
it('skips optional avatar downloads without hiding player identity', () => {
  useDataSaver.setState({ enabled: true });
  const view = render(
    <Avatar name="Nimal" src="https://example.invalid/avatar.png" />,
  );
  expect(view.container.querySelector('img')).toBeNull();
  expect(view.container.textContent).toBe('N');
});
it('offers accessible settings and persists switching modes', () => {
  render(<PwaControls />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Data Saver Mode' }));
  expect(localStorage.getItem('omi-data-saver')).toBe('true');
  expect(document.documentElement.classList.contains('data-saver')).toBe(true);
  expect(
    screen.getByText(/Gameplay checks and voice controls stay active/),
  ).toBeTruthy();
});
