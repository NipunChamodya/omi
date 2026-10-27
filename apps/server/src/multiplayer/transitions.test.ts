import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { RoomService, DEFAULT_LIMITS } from './rooms.js';
import type { Identity } from './support.js';
import type { Peer } from './rooms.js';
import {
  createDeck,
  createRound,
  cutAndDeal,
  selectTrump,
  playCard,
  leftOf,
  nextSeat,
  settleRound,
  createLedger,
  countTricks,
} from '@omi/game-engine';
it.each(['closing', 'revoked'] as const)(
  'refuses start/next-round/restart with a %s peer before heartbeat cleanup',
  async (condition) => {
    const identities: Identity[] = Array.from({ length: 4 }, () => ({
      actorId: randomUUID(),
      userId: randomUUID(),
      tokenHash: randomUUID(),
      displayName: 'Fixture',
      expiresAt: 1000,
    }));
    const active = new Set(identities.map((identity) => identity.tokenHash));
    // Hypothetical fixture policies exercise machinery; these are not approved production rules.
    const service = new RoomService(
      () => 0,
      (identity) => active.has(identity.tokenHash),
      DEFAULT_LIMITS,
      {
        nextDealer: (round) => nextSeat(round.dealer),
        replacementDealer: (round) => nextSeat(round.dealer),
      },
      () => 0,
    );
    const descriptor = service.match(identities);
    const room = service.authorize(descriptor.roomId, identities[0]!).room;
    const peers: Peer[] = identities.map((identity) => ({
      identity,
      alive: true,
      socket: {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
        close: vi.fn(),
        terminate: vi.fn(),
      } as unknown as WebSocket,
    }));
    for (let i = 0; i < 4; i++) {
      room.peers.set(identities[i]!.actorId, peers[i]!);
      room.members[i]!.ready = true;
    }
    if (condition === 'closing')
      Object.defineProperty(peers[2]!.socket, 'readyState', {
        value: WebSocket.CLOSING,
      });
    else active.delete(identities[2]!.tokenHash);
    let round = createRound(randomUUID(), 0, createDeck());
    round = cutAndDeal(round, leftOf(round.dealer), 12);
    round = selectTrump(
      round,
      round.selector,
      round.hands[round.selector][0]!.suit,
    );
    for (let i = 0; i < 32; i++)
      round = playCard(round, round.turn!, round.hands[round.turn!][0]!);
    const settlement = settleRound(round, createLedger());
    if (settlement.status !== 'settled') throw new Error('Invalid fixture');
    for (const type of ['start', 'next-round', 'restart'] as const) {
      room.round =
        type === 'start'
          ? null
          : type === 'restart'
            ? { ...round, phase: 'cancelled' }
            : round;
      room.ledger = settlement.ledger;
      room.result = {
        status: 'settled',
        outcome: settlement.result,
        tricks: countTricks(round),
      };
      const before = room.round;
      await service.command(room.id, peers[0]!, {
        type,
        payload: {},
        roomId: room.id,
        actorId: identities[0]!.actorId,
        actionId: randomUUID(),
        expectedVersion: room.version,
      });
      expect(room.round).toBe(before);
      expect(room.ledger).toBe(settlement.ledger);
      expect(vi.mocked(peers[0]!.socket.send).mock.calls.at(-1)?.[0]).toContain(
        'FOUR_READY_PLAYERS_REQUIRED',
      );
    }
    service.stop();
  },
);
