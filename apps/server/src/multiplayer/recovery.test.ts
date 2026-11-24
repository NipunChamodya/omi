import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createDeck,
  createLedger,
  createRound,
  cutAndDeal,
  leftOf,
  selectTrump,
} from '@omi/game-engine';
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
    repository.matchStorage.save({
      ...base,
      members: base.members.map((member) =>
        member.seat === 1
          ? { ...member, bot: true }
          : member.seat === 2
            ? { ...member, bot: true, avatarUrl: null }
            : member,
      ),
    });
    const guests = repository.matchStorage.loadActive(1)[0]!.members;
    expect(guests[1]?.permanentBot).toBe(true);
    expect(guests[2]?.permanentBot).toBeUndefined();
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

it('archives a rematch generation, recovers the same room, and settles the new result once', async () => {
  const repo = new SqliteAccounts(':memory:', true);
  let now = 0;
  const open = () =>
    new RoomService(
      () => now,
      () => true,
      DEFAULT_LIMITS,
      () => 0,
      repo.matchStorage,
    );
  let service = open();
  try {
    const players = Array.from({ length: 4 }, (_, i) => {
      const user = repo.googleUser(`rematch-${i}`, `Player ${i}`, null, now);
      return peer({
        actorId: user.id,
        userId: user.id,
        tokenHash: randomUUID(),
        displayName: user.displayName,
        expiresAt: 1_000_000,
      });
    });
    const host = players[0]!;
    const { roomId } = service.match(players.map(({ identity }) => identity));
    const command = async (
      player: Peer,
      type: 'start' | 'rematch' | 'ready',
    ) => {
      const snapshot = await service.getSnapshot(roomId, player.identity);
      const envelope = {
        roomId,
        actorId: player.identity.actorId,
        expectedVersion: snapshot.version,
        actionId: randomUUID(),
      };
      await service.command(
        roomId,
        player,
        type === 'ready'
          ? { ...envelope, type, payload: { ready: true } }
          : { ...envelope, type, payload: {} },
      );
    };
    for (const member of players) {
      await service.attach(roomId, member);
      await command(member, 'ready');
    }
    await command(host, 'start');
    const initial = await service.getSnapshot(roomId, host.identity);
    const loser = players[1]!;
    await service.detach(roomId, loser);
    now = 40_000;
    service.tick();
    const settled = await service.getSnapshot(roomId, host.identity);
    expect(settled.score.final?.reason).toBe('ranked_forfeit');
    await service.attach(roomId, loser);
    for (const member of players) await command(member, 'rematch');

    const renewed = await service.getSnapshot(roomId, host.identity);
    expect(renewed.game?.id).not.toBe(initial.game?.id);
    expect(renewed.version).toBeGreaterThan(settled.version);
    expect(renewed.score).toEqual({ totals: [10, 10], carry: 0, final: null });
    expect(repo.matchStorage.loadActive(2)).toMatchObject([
      { id: roomId, version: renewed.version },
    ]);
    expect(service.statistics(host.identity.actorId)?.played).toBe(1);
    service.stop();
    service = open();
    for (const member of players) await service.attach(roomId, member);
    expect((await service.getSnapshot(roomId, host.identity)).game?.id).toBe(
      renewed.game?.id,
    );
    await service.detach(roomId, loser);
    now = 80_000;
    service.tick();
    await service.getSnapshot(roomId, host.identity);
    expect(service.statistics(host.identity.actorId)).toMatchObject({
      played: 2,
      wins: 2,
      partnerships: [{ matches: 2, wins: 2 }],
      experimentalRating: { history: [{ previous: 1016 }, { previous: 1000 }] },
    });
  } finally {
    service.stop();
    repo.close();
  }
});

it('expires an invitation at its exact deadline', async () => {
  let now = 0;
  const service = new RoomService(
    () => now,
    () => true,
    DEFAULT_LIMITS,
  );
  const person = (displayName: string) => {
    const actorId = randomUUID();
    return {
      actorId,
      userId: actorId,
      displayName,
      tokenHash: randomUUID(),
      expiresAt: 1_000_000,
    };
  };
  try {
    const host = person('Host');
    const guest = person('Friend');
    service.create(host, {
      actorId: host.actorId,
      actionId: randomUUID(),
      expectedVersion: 0,
    });
    service.createInvitation(host, guest.actorId, true);
    const [invite] = service.listInvitations(guest.actorId, () => true);
    expect(invite).toBeDefined();
    now = invite!.expiresAt;
    await expect(
      service.respondToInvitation(guest, invite!.id, true, () => true),
    ).rejects.toMatchObject({ code: 'INVITATION_UNAVAILABLE' });
    expect(service.forActor(guest.actorId)).toBeNull();
  } finally {
    service.stop();
  }
});

it('replays committed HTTP create and join descriptors across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'omi-receipt-'));
  const file = join(directory, 'rooms.sqlite');
  let repo = new SqliteAccounts(file);
  const open = () =>
    new RoomService(
      () => 1,
      () => true,
      DEFAULT_LIMITS,
      undefined,
      repo.matchStorage,
    );
  let rooms = open();
  const host = {
    actorId: randomUUID(),
    displayName: 'Host',
    expiresAt: 1000,
    tokenHash: 'host',
  };
  const guest = { ...host, actorId: randomUUID(), tokenHash: 'guest' };
  const create = {
    actorId: host.actorId,
    actionId: randomUUID(),
    expectedVersion: 0 as const,
  };
  try {
    const room = rooms.create(host, create);
    const join = {
      actorId: guest.actorId,
      actionId: randomUUID(),
      roomId: room.roomId,
      code: room.code,
      expectedVersion: room.version,
    };
    const [joined, replay] = await Promise.all([
      rooms.join(guest, join),
      rooms.join(guest, join),
    ]);
    expect(replay).toEqual(joined);
    rooms.stop();
    repo.close();
    repo = new SqliteAccounts(file);
    rooms = open();
    expect(rooms.create(host, create)).toEqual(room);
    expect(await rooms.join(guest, join)).toEqual(joined);
    expect(() => rooms.create(guest, create)).toThrow();
    await expect(
      rooms.join(guest, { ...join, expectedVersion: 99 }),
    ).rejects.toMatchObject({ code: 'ACTION_ID_REUSED' });
    expect((await rooms.getSnapshot(room.roomId, host)).members).toHaveLength(
      2,
    );
  } finally {
    rooms.stop();
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('releases a lobby host atomically, transfers ownership and persists remaining seats on restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'omi-release-'));
  const file = join(directory, 'rooms.sqlite');
  let repo = new SqliteAccounts(file);
  const open = () =>
    new RoomService(
      () => 1,
      () => true,
      DEFAULT_LIMITS,
      undefined,
      repo.matchStorage,
    );
  let rooms = open();
  const host = {
    actorId: randomUUID(),
    displayName: 'Host',
    expiresAt: 1000,
    tokenHash: 'host',
  };
  const guest = {
    ...host,
    actorId: randomUUID(),
    displayName: 'Guest',
    tokenHash: 'guest',
  };
  const create = () => ({
    actorId: host.actorId,
    actionId: randomUUID(),
    expectedVersion: 0 as const,
  });
  try {
    const room = rooms.create(host, create());
    await rooms.join(guest, {
      actorId: guest.actorId,
      actionId: randomUUID(),
      roomId: room.roomId,
      code: room.code,
      expectedVersion: room.version,
    });
    await Promise.all([
      rooms.releaseSeat(host, room.roomId),
      rooms.releaseSeat(host, room.roomId),
    ]);
    expect(rooms.forActor(host.actorId)).toBeNull();
    const next = rooms.create(host, create());
    expect(next.roomId).not.toBe(room.roomId);
    await rooms.releaseSeat(host, room.roomId);
    expect(rooms.forActor(host.actorId)?.roomId).toBe(next.roomId);
    rooms.stop();
    repo.close();
    repo = new SqliteAccounts(file);
    rooms = open();
    const recovered = await rooms.getSnapshot(room.roomId, guest);
    expect(recovered.hostId).toBe(guest.actorId);
    expect(recovered.you.seat).toBe(0);
    expect(recovered.members).toHaveLength(1);
    await rooms.releaseSeat(guest, room.roomId);
    expect(rooms.forActor(guest.actorId)).toBeNull();
  } finally {
    rooms.stop();
    repo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

function playingFixture(
  repository: SqliteAccounts,
  ranked = false,
  fillBots = false,
) {
  const identities = Array.from({ length: 4 }, (_, seat) => ({
    actorId: randomUUID(),
    tokenHash: randomUUID(),
    displayName: `Player ${seat}`,
    expiresAt: 200_000,
  }));
  const initial = createRound('fixture-turn', 0, createDeck());
  const dealt = cutAndDeal(initial, leftOf(initial.dealer), 16);
  const round = selectTrump(
    dealt,
    dealt.selector,
    dealt.hands[dealt.selector][0]!.suit,
  );
  const roomId = randomUUID();
  repository.matchStorage.save({
    id: roomId,
    code: 'ABCDEFGH',
    hostId: identities[0]!.actorId,
    version: 2,
    members: identities.map(({ actorId, displayName }, seat) => ({
      actorId,
      displayName,
      seat: seat as 0 | 1 | 2 | 3,
      ready: true,
      ...(fillBots && seat >= 2 && { bot: true, permanentBot: true }),
    })),
    round,
    ledger: createLedger(),
    result: null,
    lastActive: 1,
    ranked,
    receipts: [],
  });
  return { roomId, identities, turn: round.selector };
}

it('preserves a casual deadline across restart and serializes expiry with legal play', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'omi-timer-'));
  const path = join(dir, 'match.sqlite');
  let repository = new SqliteAccounts(path);
  const { roomId, identities, turn } = playingFixture(repository);
  let now = 1000;
  const open = () =>
    new RoomService(
      () => now,
      () => true,
      DEFAULT_LIMITS,
      undefined,
      repository.matchStorage,
      30_000,
    );
  let rooms = open();
  try {
    for (const id of identities) await rooms.attach(roomId, peer(id));
    const first = await Promise.all(
      identities.map((id) => rooms.getSnapshot(roomId, id)),
    );
    expect(first.map((view) => view.turnClock?.deadline)).toEqual([
      31_000, 31_000, 31_000, 31_000,
    ]);
    rooms.stop();
    repository.close();
    now = 11_000;
    repository = new SqliteAccounts(path);
    rooms = open();
    const active = peer(identities[turn]!);
    await rooms.attach(roomId, active);
    const recovered = await rooms.getSnapshot(roomId, active.identity);
    expect(recovered.turnClock).toEqual({
      deadline: 31_000,
      durationMs: 30_000,
      serverNow: 11_000,
    });
    const command = {
      roomId,
      actorId: active.identity.actorId,
      actionId: randomUUID(),
      expectedVersion: recovered.version,
      type: 'play' as const,
      payload: { card: recovered.game!.hand[0]! },
    };
    now = 30_999;
    rooms.tick();
    expect(
      (await rooms.getSnapshot(roomId, active.identity)).game?.trick,
    ).toHaveLength(0);
    now = 31_000;
    await rooms.command(roomId, active, command);
    expect(vi.mocked(active.socket.send).mock.lastCall?.[0]).toContain(
      'TURN_EXPIRED',
    );
    rooms.tick();
    rooms.tick();
    const updated = await rooms.getSnapshot(roomId, active.identity);
    expect(updated.game?.trick).toHaveLength(1);
    expect(updated.turnClock?.deadline).toBe(61_000);
    expect(updated.score.totals).toEqual([10, 10]);
    await rooms.command(roomId, active, command);
    expect(
      (await rooms.getSnapshot(roomId, active.identity)).turnClock?.deadline,
    ).toBe(61_000);
  } finally {
    rooms.stop();
    repository.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

it.each([false, true])(
  'persists permanent casual departure and preserves ranked restrictions (ranked %s)',
  async (ranked) => {
    const dir = mkdtempSync(join(tmpdir(), 'omi-permanent-'));
    const path = join(dir, 'match.sqlite');
    let repository = new SqliteAccounts(path);
    const { roomId, identities } = playingFixture(repository, ranked, !ranked);
    const [host, guest] = identities as [Identity, Identity];
    const open = () =>
      new RoomService(
        () => 100,
        () => true,
        DEFAULT_LIMITS,
        undefined,
        repository.matchStorage,
        30_000,
      );
    let rooms = open();
    try {
      await rooms.attach(roomId, peer(host));
      await rooms.attach(roomId, peer(guest));
      if (ranked) {
        await expect(rooms.releaseSeat(host, roomId)).rejects.toMatchObject({
          code: 'MATCH_IN_PROGRESS',
        });
        expect(
          (await rooms.getSnapshot(roomId, guest)).turnClock,
        ).toBeUndefined();
        expect(rooms.forActor(host.actorId)?.roomId).toBe(roomId);
        return;
      }
      await Promise.all([
        rooms.releaseSeat(host, roomId),
        rooms.releaseSeat(host, roomId),
      ]);
      expect(rooms.forActor(host.actorId)).toBeNull();
      expect(() => rooms.authorize(roomId, host)).toThrow();
      const next = rooms.create(host, {
        actorId: host.actorId,
        actionId: randomUUID(),
        expectedVersion: 0,
      });
      await rooms.releaseSeat(host, roomId);
      rooms.stop();
      repository.close();
      repository = new SqliteAccounts(path);
      rooms = open();
      const recovered = await rooms.getSnapshot(roomId, guest);
      expect(recovered.hostId).toBe(guest.actorId);
      expect(recovered.members[0]).toMatchObject({ bot: true, seat: 0 });
      expect(recovered.score.totals).toEqual([10, 10]);
      expect(rooms.forActor(host.actorId)?.roomId).toBe(next.roomId);
      expect(() => rooms.authorize(roomId, host)).toThrow();
      await rooms.releaseSeat(guest, roomId);
      expect(rooms.forActor(guest.actorId)).toBeNull();
      expect(rooms.forActor(host.actorId)?.roomId).toBe(next.roomId);
      expect(
        repository.matchStorage.loadActive(2).map((saved) => saved.id),
      ).toEqual([next.roomId]);
    } finally {
      rooms.stop();
      repository.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

it('rejects a pending join after the host closes the lobby instead of resurrecting it', async () => {
  const repository = new SqliteAccounts(':memory:');
  const rooms = new RoomService(
    () => 1,
    () => true,
    DEFAULT_LIMITS,
    undefined,
    repository.matchStorage,
  );
  const host = {
    actorId: randomUUID(),
    displayName: 'Host',
    expiresAt: 1_000,
    tokenHash: 'host',
  };
  const guest = { ...host, actorId: randomUUID(), tokenHash: 'guest' };
  try {
    const lobby = rooms.create(host, {
      actorId: host.actorId,
      expectedVersion: 0,
      actionId: randomUUID(),
    });
    const release = rooms.releaseSeat(host, lobby.roomId);
    const late = rooms.join(guest, {
      actorId: guest.actorId,
      roomId: lobby.roomId,
      code: lobby.code,
      expectedVersion: 0,
      actionId: randomUUID(),
    });
    await expect(late).rejects.toMatchObject({ code: 'ROOM_EXPIRED' });
    await release;
    expect(rooms.forActor(guest.actorId)).toBeNull();
    expect(repository.matchStorage.loadActive(2)).toEqual([]);
  } finally {
    rooms.stop();
    repository.close();
  }
});

it.each(['casual', 'ranked'] as const)(
  'plays a complete seeded %s match through real room commands and starts a rematch',
  async (mode) => {
    const repository = new SqliteAccounts(':memory:');
    let rng = 1;
    const entropy = (limit: number) =>
      ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) >>> 8) % limit;
    const rooms = new RoomService(
      () => 100,
      () => true,
      DEFAULT_LIMITS,
      entropy,
      repository.matchStorage,
    );
    const people = Array.from({ length: 4 }, (_, seat) => {
      const actorId = randomUUID();
      return peer({
        actorId,
        userId: actorId,
        displayName: `Player ${seat}`,
        expiresAt: 10_000,
        tokenHash: actorId,
      });
    });
    try {
      const host = people[0]!;
      const initial =
        mode === 'ranked'
          ? rooms.match(people.map(({ identity }) => identity))
          : rooms.create(host.identity, {
              actorId: host.identity.actorId,
              actionId: randomUUID(),
              expectedVersion: 0,
            });
      const { roomId } = initial;
      if (mode === 'casual')
        for (const player of people.slice(1)) {
          const { version } = rooms.preview(player.identity, initial.code);
          await rooms.join(player.identity, {
            roomId,
            code: initial.code,
            actorId: player.identity.actorId,
            actionId: randomUUID(),
            expectedVersion: version,
          });
        }
      for (const player of people) await rooms.attach(roomId, player);
      async function act(
        player: Peer,
        action: Pick<import('@omi/shared').ClientCommand, 'type' | 'payload'>,
      ) {
        const snapshot = await rooms.getSnapshot(roomId, player.identity);
        const actionId = randomUUID();
        await rooms.command(roomId, player, {
          ...action,
          roomId,
          expectedVersion: snapshot.version,
          actionId,
          actorId: player.identity.actorId,
        } as import('@omi/shared').ClientCommand);
        const message = JSON.parse(
          String(vi.mocked(player.socket.send).mock.lastCall?.[0]),
        );
        expect(message).toMatchObject({ actionId, type: 'ack' });
      }
      for (const player of people)
        await act(player, { type: 'ready', payload: { ready: true } });
      await act(host, { type: 'start', payload: {} });
      let played = 0;
      for (let hand = 0; hand < 9; hand++) {
        const before = await rooms.getSnapshot(roomId, host.identity);
        const cutter = people[leftOf(before.game!.dealer)]!;
        await act(cutter, { type: 'cut', payload: { offset: 16 } });
        const selector = people[before.game!.selector]!;
        const deal = await rooms.getSnapshot(roomId, selector.identity);
        await act(selector, {
          type: 'trump',
          payload: { suit: deal.game!.hand[0]!.suit },
        });
        for (let play = 0; play < 32; play++) {
          const table = await rooms.getSnapshot(roomId, host.identity);
          const player = people[table.game!.turn!]!;
          const personal = await rooms.getSnapshot(roomId, player.identity);
          const legal =
            personal.game!.hand.find(
              (card) => card.suit === personal.game!.trick[0]?.card.suit,
            ) ?? personal.game!.hand[0]!;
          await act(player, { type: 'play', payload: { card: legal } });
          played++;
        }
        const ended = await rooms.getSnapshot(roomId, host.identity);
        expect(ended.game?.tricks).toHaveLength(8);
        expect(ended.score.totals[0] + ended.score.totals[1]).toBe(20);
        expect(
          ended.members.every(
            (member) => !member.bot && member.seat % 2 === member.team,
          ),
        ).toBe(true);
        if (hand < 8) {
          expect(ended.score.final).toBeNull();
          await act(host, { type: 'next-round', payload: {} });
        } else {
          expect(ended.score.final?.reason).toBe('loan_loss');
          for (const player of people) {
            const updates = vi
              .mocked(player.socket.send)
              .mock.calls.map(([wire]) => JSON.parse(String(wire)));
            expect(
              updates.reverse().find((message) => message.type === 'event'),
            ).toMatchObject({
              rematchAvailable: true,
              version: ended.version,
              event: {
                kind: 'card-played',
                score: { final: { reason: 'loan_loss' } },
              },
            });
          }
        }
      }
      expect(played).toBe(288);
      const finished =
        rooms.authorize(roomId, host.identity).room.matchId ?? roomId;
      expect(
        repository.matchStorage.statistics(host.identity.actorId).played,
      ).toBe(1);
      for (const player of people)
        await act(player, { type: 'rematch', payload: {} });
      const rematch = await rooms.getSnapshot(roomId, host.identity);
      expect(rematch.score.totals).toEqual([10, 10]);
      expect(rematch.score.final).toBeNull();
      expect(rooms.authorize(roomId, host.identity).room.matchId).not.toBe(
        finished,
      );
      expect(
        repository.matchStorage.statistics(host.identity.actorId).played,
      ).toBe(1);
    } finally {
      rooms.stop();
      repository.close();
    }
  },
);
