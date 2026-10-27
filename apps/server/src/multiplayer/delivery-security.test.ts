import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { VoiceService } from '../voice/service.js';
import { SocialService } from '../social/service.js';
import type { Identity } from './support.js';
import { commandSchema, createSchema, joinSchema } from './validation.js';

class Socket extends EventEmitter {
  readyState = WebSocket.OPEN;
  bufferedAmount = 0;
  send = vi.fn();
  close = vi.fn();
  terminate = vi.fn();
  asWebSocket() {
    return this as unknown as WebSocket;
  }
}

it.each(['voice', 'social'] as const)(
  'rechecks %s recipients before broadcasting to revoked sessions',
  async (kind) => {
    const roomId = randomUUID();
    const makeIdentity = (): Identity => ({
      actorId: randomUUID(),
      tokenHash: randomUUID(),
      displayName: 'fixture',
      expiresAt: 100,
    });
    const first = makeIdentity(),
      second = makeIdentity();
    const revoked = new Set<string>();
    const authorize = (_roomId: string, identity: Identity) => {
      if (revoked.has(identity.actorId)) throw new Error('revoked');
      return { hostId: first.actorId };
    };
    const service =
      kind === 'voice'
        ? new VoiceService(authorize, () => 0, 1)
        : new SocialService(
            authorize,
            () => true,
            () => randomUUID(),
            () => 0,
            1,
          );
    const expired = new Socket(),
      active = new Socket();
    try {
      service.connect(roomId, first, expired.asWebSocket());
      expired.send.mockClear();
      revoked.add(first.actorId);
      service.connect(roomId, second, active.asWebSocket());
      if (kind === 'social') {
        const hello = JSON.parse(active.send.mock.calls[0]![0] as string) as {
          connectionId: string;
        };
        active.emit(
          'message',
          Buffer.from(
            JSON.stringify({
              roomId,
              actorId: second.actorId,
              connectionId: hello.connectionId,
              actionId: randomUUID(),
              expectedVersion: 0,
              type: 'chat',
              payload: { text: 'synthetic private room chat' },
            }),
          ),
          false,
        );
        await expect
          .poll(() => active.send.mock.calls.length)
          .toBeGreaterThan(1);
      }
      expect(expired.send).not.toHaveBeenCalled();
      expect(expired.close).toHaveBeenCalledWith(1008, 'Authorization expired');
      expect(active.send).toHaveBeenCalled();
    } finally {
      service.stop();
    }
  },
);

it('rejects bounded deterministic malformed envelopes and mass-assignment fields', () => {
  const envelope = {
    roomId: randomUUID(),
    actorId: randomUUID(),
    actionId: randomUUID(),
    expectedVersion: 0,
  };
  const valid = {
    ...envelope,
    type: 'play',
    payload: { card: { suit: 'clubs', rank: 'A' } },
  };
  expect(commandSchema.safeParse(valid).success).toBe(true);
  // Fixed corpus, no random fuzz scheduling or unbounded payload generation.
  for (const value of [
    null,
    false,
    [],
    {},
    '',
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    '\u0000',
    'x'.repeat(4097),
  ]) {
    for (const key of [
      'roomId',
      'actorId',
      'actionId',
      'expectedVersion',
      'type',
      'payload',
    ]) {
      expect(commandSchema.safeParse({ ...valid, [key]: value }).success).toBe(
        false,
      );
    }
  }
  for (const key of ['hands', 'deck', 'score', 'seat', '__proto__']) {
    expect(commandSchema.safeParse({ ...valid, [key]: {} }).success).toBe(
      false,
    );
    expect(
      createSchema.safeParse({
        actorId: envelope.actorId,
        actionId: envelope.actionId,
        expectedVersion: 0,
        [key]: {},
      }).success,
    ).toBe(false);
    expect(
      joinSchema.safeParse({ ...envelope, code: 'ABCDEFGH', [key]: {} })
        .success,
    ).toBe(false);
  }
});
