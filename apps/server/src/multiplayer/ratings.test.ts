import { expect, it } from 'vitest';
import { parseConfig } from '../config.js';
import { teamRatingChange } from './ratings.js';

it('uses team expectation and reduces the reward for a favored team', () => {
  expect(teamRatingChange(1000, 1000, true)).toBe(16);
  expect(teamRatingChange(1000, 1000, false)).toBe(-16);
  expect(teamRatingChange(1400, 1000, true)).toBe(3);
  expect(teamRatingChange(1400, 1000, false)).toBe(-29);
});
it('requires explicit local Elo opt-in and rejects public production activation', () => {
  expect(parseConfig({}).EXPERIMENTAL_ELO).toBe(false);
  expect(
    parseConfig({ NODE_ENV: 'test', EXPERIMENTAL_ELO: 'true' })
      .EXPERIMENTAL_ELO,
  ).toBe(true);
  expect(() =>
    parseConfig({
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://omi.example',
      EXPERIMENTAL_ELO: 'true',
    }),
  ).toThrow('Experimental Elo is disabled in production');
});
