// @vitest-environment jsdom
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  readRevealSeconds,
  remainingTurnMs,
  TurnCountdown,
} from './TableTiming';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const clock = { serverNow: 14000, deadline: 44000, durationMs: 30000 };

it('uses the remaining server time on a late join', () => {
  expect(remainingTurnMs({ ...clock, serverNow: 39000 }, 3000)).toBe(2000);
});
it('clamps an expired server deadline at zero', () => {
  expect(remainingTurnMs(clock, 35000)).toBe(0);
});
it('does not exceed the configured duration when the server sample is early', () => {
  expect(remainingTurnMs({ ...clock, serverNow: 1000 }, 0)).toBe(30000);
});
it('counts down from monotonic elapsed time without relying on the device wall clock', () => {
  vi.useFakeTimers({
    toFake: ['performance', 'Date', 'setInterval', 'clearInterval'],
  });
  render(<TurnCountdown clock={clock} />);
  expect(screen.getByRole('timer').textContent).toBe('00:30');
  vi.setSystemTime(new Date('2060-01-01'));
  act(() => vi.advanceTimersByTime(27000));
  expect(screen.getByRole('timer').textContent).toBe('00:03');
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByRole('timer').textContent).toBe('00:00');
});
it.each([2, 3, 5])(
  'loads the supported %s-second reveal preference',
  (duration) => {
    localStorage.setItem('omi.trick-reveal', String(duration));
    expect(readRevealSeconds()).toBe(duration);
  },
);
it('falls back to normal for unsupported reveal values', () => {
  localStorage.setItem('omi.trick-reveal', '60');
  expect(readRevealSeconds()).toBe(3);
});
