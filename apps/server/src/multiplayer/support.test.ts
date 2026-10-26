import { describe, expect, it } from 'vitest';
import { GuestSessions, RateLimiter, SerialQueue } from './support.js';

describe('bounded transport primitives', () => {
  it('serializes tasks, survives rejection and bounds pending work while allowing essential cleanup', async () => {
    const queue = new SerialQueue(2);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen: number[] = [];
    const first = queue.run(async () => {
      seen.push(1);
      await gate;
      seen.push(2);
    });
    const second = queue.run(() => {
      seen.push(3);
      throw new Error('rejected');
    });
    const secondRejected = expect(second).rejects.toThrow('rejected');
    await expect(queue.run(() => undefined)).rejects.toMatchObject({
      code: 'ROOM_BUSY',
    });
    const cleanup = queue.run(() => {
      seen.push(4);
    }, true);
    expect(seen).toEqual([1]);
    release();
    await first;
    await secondRejected;
    await cleanup;
    await queue.run(() => {
      seen.push(5);
    });
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });
  it('expires opaque guest credentials without exposing stored credential material', () => {
    let now = 0;
    const sessions = new GuestSessions(() => now, 100, 1);
    const first = sessions.create('one');
    expect(first.token).toHaveLength(43);
    expect(first.identity.tokenHash).not.toBe(first.token);
    expect(sessions.get(first.token)).toEqual(first.identity);
    expect(sessions.get('invalid')).toBeUndefined();
    expect(() => sessions.create('two')).toThrow('SESSION_CAPACITY');
    now = 100;
    expect(sessions.get(first.token)).toBeUndefined();
    expect(sessions.active(first.identity)).toBe(false);
    const second = sessions.create('two');
    expect(second.identity.actorId).not.toBe(first.identity.actorId);
    expect(second.token).not.toBe(first.token);
  });
  it('enforces rate windows with bounded keys and recovers after expiry', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now, 2, 100, 1);
    expect(limiter.take('one')).toBe(true);
    expect(limiter.take('one')).toBe(true);
    expect(limiter.take('one')).toBe(false);
    expect(limiter.take('two')).toBe(false);
    now = 100;
    expect(limiter.take('two')).toBe(true);
    expect(limiter.take('one')).toBe(false);
    now = 200;
    limiter.sweep();
    expect(limiter.take('one')).toBe(true);
  });
});
