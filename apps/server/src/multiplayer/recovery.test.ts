import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeck, createLedger, createRound } from '@omi/game-engine';
import { WebSocket } from 'ws';
import { expect, it, vi } from 'vitest';
import { SqliteAccounts } from '../persistence/repository.js';
import { DEFAULT_LIMITS, RoomService } from './rooms.js';
import type { Peer } from './rooms.js';
import { GuestSessions } from './support.js';
import type { Identity } from './support.js';

const peer = (identity: Identity): Peer => ({
  identity,
  alive: true,
  socket: {
    readyState: WebSocket.OPEN,
    bufferedAmount: 0,
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
  } as unknown as WebSocket,
});

it.each([false, true])(
  'recovers the committed ranked round and records terminal settlement once (double forfeit %s)',
  async (double) => {
    const dir = mkdtempSync(join(tmpdir(), 'omi-match-'));
    const file = join(dir, 'matches.sqlite');
    let repository = new SqliteAccounts(file, true);
    let now = 0;
    const open = () =>
      new RoomService(
        () => now,
        () => true,
        DEFAULT_LIMITS,
        () => 0,
        repository.matchStorage,
      );
    let service = open();
    try {
      const identities = Array.from({ length: 4 }, (_, i) => {
        const id = repository.googleUser(
          `fixture-${i}`,
          `Player ${i}`,
          null,
          0,
        ).id;
        return {
          actorId: id,
          userId: id,
          displayName: `Player ${i}`,
          tokenHash: randomUUID(),
          expiresAt: 100_000,
        };
      });
      const { roomId } = service.match(identities);
      const players = identities.map(peer);
      const host = players[0]!;
      for (const player of players) {
        await service.attach(roomId, player);
        const state = await service.getSnapshot(roomId, player.identity);
        await service.command(roomId, player, {
          roomId,
          actorId: player.identity.actorId,
          actionId: randomUUID(),
          expectedVersion: state.version,
          type: 'ready',
          payload: { ready: true },
        });
      }
      const state = await service.getSnapshot(roomId, host.identity);
      const start = {
        roomId,
        actorId: host.identity.actorId,
        actionId: randomUUID(),
        expectedVersion: state.version,
        type: 'start' as const,
        payload: {},
      };
      await service.command(roomId, host, start);
      const before = await service.getSnapshot(roomId, host.identity);
      await service.detach(roomId, players[1]!);
      if (double) await service.detach(roomId, players[2]!);
      service.stop();
      repository.close();

      now = 1_000;
      repository = new SqliteAccounts(file, true);
      service = open();
      for (const player of [
        host,
        ...(double ? [] : [players[2]!]),
        players[3]!,
      ])
        await service.attach(roomId, player);
      const recovered = await service.getSnapshot(roomId, host.identity);
      expect(recovered.game).toEqual(before.game);
      expect(recovered.members[1]?.disconnectDeadline).toBe(40_000);
      await service.command(roomId, host, start);
      expect(vi.mocked(host.socket.send).mock.lastCall?.[0]).toContain(
        '"duplicate":true',
      );
      now = 39_999;
      service.tick();
      expect(
        (await service.getSnapshot(roomId, host.identity)).score.final,
      ).toBeNull();
      now += 1;
      service.tick();
      expect(
        (await service.getSnapshot(roomId, host.identity)).score.final,
      ).toMatchObject(
        double
          ? { reason: 'double_forfeit', winner: null, loser: null }
          : { reason: 'ranked_forfeit', winner: 0, loser: 1 },
      );
      expect(service.statistics(host.identity.actorId)).toMatchObject({
        played: 1,
        wins: double ? 0 : 1,
        rankedWins: double ? 0 : 1,
        rankedForfeitLosses: double ? 1 : 0,
        experimentalRating: {
          rating: double ? 1000 : 1016,
          history: double ? [] : [{ previous: 1000, rating: 1016 }],
        },
      });
      expect(service.statistics(players[1]!.identity.actorId)).toMatchObject({
        played: 1,
        rankedForfeitLosses: 1,
        experimentalRating: { rating: double ? 1000 : 984 },
      });
      service.tick();
      expect(service.statistics(host.identity.actorId)?.played).toBe(1);
      const terminal = await service.getSnapshot(roomId, host.identity);
      const next = {
        roomId,
        actorId: host.identity.actorId,
        actionId: randomUUID(),
        expectedVersion: terminal.version,
        type: 'next-round' as const,
        payload: {},
      };
      await service.command(roomId, host, next);
      expect(vi.mocked(host.socket.send).mock.lastCall?.[0]).toContain(
        'MATCH_COMPLETE',
      );
      await service.command(roomId, host, {
        ...next,
        actionId: randomUUID(),
        type: 'leave-match',
      });
      expect(service.forActor(host.identity.actorId)).toBeNull();
      expect(() => service.authorize(roomId, host.identity)).toThrow();
      expect(service.statistics(host.identity.actorId)?.played).toBe(1);
      service.stop();
      repository.close();
      repository = new SqliteAccounts(file, true);
      service = open();
      expect(service.forActor(host.identity.actorId)).toBeNull();
      expect(service.statistics(host.identity.actorId)?.played).toBe(1);
    } finally {
      service.stop();
      repository.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

it('uses a casual bot for the cut after 40 seconds and restores human control on attach', async () => {
  let now = 0;
  const service = new RoomService(
    () => now,
    () => true,
    DEFAULT_LIMITS,
    () => 1,
  );
  try {
    const identity = {
      actorId: randomUUID(),
      displayName: 'Host',
      tokenHash: randomUUID(),
      expiresAt: 100_000,
    };
    const host = peer(identity);
    const created = service.create(identity, {
      actorId: identity.actorId,
      actionId: randomUUID(),
      expectedVersion: 0,
    });
    const roomId = created.roomId;
    await service.attach(roomId, host);
    const observer = {
      ...identity,
      actorId: randomUUID(),
      tokenHash: randomUUID(),
    };
    const observerPeer = peer(observer);
    let view = await service.getSnapshot(roomId, identity);
    await service.join(observer, {
      roomId,
      code: created.code,
      actorId: observer.actorId,
      actionId: randomUUID(),
      expectedVersion: view.version,
    });
    await service.attach(roomId, observerPeer);
    view = await service.getSnapshot(roomId, observer);
    await service.command(roomId, observerPeer, {
      roomId,
      actorId: observer.actorId,
      actionId: randomUUID(),
      expectedVersion: view.version,
      type: 'ready',
      payload: { ready: true },
    });
    for (const type of ['add-bot', 'add-bot', 'ready', 'start'] as const) {
      const view = await service.getSnapshot(roomId, identity);
      const envelope = {
        roomId,
        actorId: identity.actorId,
        actionId: randomUUID(),
        expectedVersion: view.version,
      };
      await service.command(
        roomId,
        host,
        type === 'ready'
          ? { ...envelope, type, payload: { ready: true } }
          : { ...envelope, type, payload: {} },
      );
    }
    const room = service.authorize(roomId, identity).room;
    expect(room.members.filter((member) => member.bot)).toHaveLength(2);
    expect(room.round?.phase).toBe('awaiting-cut');
    await service.detach(roomId, host);
    now = 39_999;
    service.tick();
    await service.getSnapshot(roomId, observer);
    expect(room.round?.phase).toBe('awaiting-cut');
    now += 1;
    service.tick();
    await service.getSnapshot(roomId, observer);
    expect(room.round?.phase).toBe('awaiting-trump');
    expect(room.members[0]?.bot).toBe(true);
    await service.attach(roomId, host);
    expect(room.members[0]?.bot).toBe(false);
    expect(
      (await service.getSnapshot(roomId, identity)).game?.hand,
    ).toHaveLength(4);
  } finally {
    service.stop();
  }
});

it('recovers an unexpired guest credential and persists revocation without storing the raw token', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omi-guest-'));
  const path = join(dir, 'games.sqlite');
  let db = new SqliteAccounts(path);
  try {
    let sessions = new GuestSessions(() => 0, 60_000, 4, db.guests);
    const { token, identity } = sessions.create('Guest');
    expect(db.guests.loadActive(0, 4)[0]?.tokenHash).not.toBe(token);
    db.close();
    db = new SqliteAccounts(path);
    sessions = new GuestSessions(() => 500, 60_000, 4, db.guests);
    expect(sessions.get(token)?.actorId).toBe(identity.actorId);
    sessions.revoke(token);
    expect(
      new GuestSessions(() => 500, 60_000, 4, db.guests).get(token),
    ).toBeUndefined();
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it('recovers V2 rule gates and retires an old pending vote', () => {
  const repository = new SqliteAccounts(':memory:');
  try {
    const round = createRound('old-hand', 0, createDeck());
    const base = {
      id: 'saved',
      code: 'ABCDEFGH',
      hostId: '0',
      version: 5,
      members: [0, 1, 2, 3].map((seat) => ({
        actorId: String(seat),
        displayName: 'Fixture',
        seat: seat as 0 | 1 | 2 | 3,
        ready: true,
      })),
      round,
      ledger: { ...createLedger(), carry: 1 as const },
      result: null,
      lastActive: 0,
      ranked: false,
      receipts: [],
      cancellationVote: { requester: 2, votes: [] },
    };
    repository.matchStorage.save(base);
    expect(repository.matchStorage.loadActive(1)[0]).not.toHaveProperty(
      'cancellationVote',
    );
    const old = {
      ...base,
      round: {
        ...round,
        phase: 'complete' as const,
        tricks: Array.from({ length: 8 }, (_, index) => ({
          plays: [],
          winner: (index % 2) as 0 | 1,
        })),
      },
      result: { status: 'unresolved', reason: 'REPEATED_DRAW' },
    };
    repository.matchStorage.save(old as unknown as typeof base);
    expect(repository.matchStorage.loadActive(1)[0]).toMatchObject({
      result: { status: 'settled', outcome: 'seporu' },
      ledger: { carry: 1, settledRounds: ['old-hand'] },
    });
    repository.matchStorage.save({
      ...base,
      ledger: { ...base.ledger, continuationBlocked: true },
      result: { status: 'settled', outcome: 'kapothi', tricks: [8, 0] },
    } as Parameters<typeof repository.matchStorage.save>[0]);
    expect(repository.matchStorage.loadActive(1)[0]?.ledger.carry).toBe(0);
  } finally {
    repository.close();
  }
});
