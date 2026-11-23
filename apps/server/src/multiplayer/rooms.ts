import { randomInt, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type {
  Ack,
  ClientCommand,
  Failure,
  RoomDescriptor,
  RoomEvent,
  RoundResult,
  ServerMessage,
  Snapshot,
  PublicProfile,
} from '@omi/shared';
import {
  accuse,
  canRequestCancellation,
  cancelRound,
  restartCancelledRound,
  chooseInitialDealer,
  countTricks,
  createDeck,
  createLedger,
  createRound,
  cutAndDeal,
  EngineError,
  otherTeam,
  RANKS,
  leftOf,
  nextSeat,
  playCard,
  selectTrump,
  settleRound,
  shuffleDeck,
  teamOf,
} from '@omi/game-engine';
import type {
  PrivateRound,
  RandomInt,
  ScoreLedger,
  Seat,
} from '@omi/game-engine';
import {
  handCounts,
  publicCard,
  publicMember,
  publicScore,
  publicTrick,
  roundHeader,
  snapshot,
} from './projection.js';
import { storedMatch } from './match-storage.js';
import type { MatchStorage } from './match-storage.js';
import { RoomError, SerialQueue } from './support.js';
import type { Identity } from './support.js';

export type RoomMember = {
  actorId: string;
  displayName: string;
  seat: Seat;
  ready: boolean;
  bot?: boolean;
  departed?: boolean;
  disconnectDeadline?: number;
  avatarUrl?: string | null;
};
export type Peer = { socket: WebSocket; identity: Identity; alive: boolean };
export type Receipt = { fingerprint: string; reply: Ack | Failure };
export type Room = {
  id: string;
  code: string;
  hostId: string;
  version: number;
  members: RoomMember[];
  peers: Map<string, Peer>;
  round: PrivateRound | null;
  ledger: ScoreLedger;
  result: RoundResult;
  ranked?: boolean;
  queue: SerialQueue;
  receipts: Map<string, Receipt>;
  lastActive: number;
};
export type Limits = {
  maxRooms: number;
  maxSessions: number;
  queueDepth: number;
  actionsPerMember: number;
  sessionTtlMs: number;
  idleRoomTtlMs: number;
  httpPerMinute: number;
  messagesPerTenSeconds: number;
  maxBufferedBytes: number;
};
export const DEFAULT_LIMITS: Readonly<Limits> = {
  maxRooms: 100,
  maxSessions: 1000,
  queueDepth: 64,
  actionsPerMember: 512,
  sessionTtlMs: 6 * 60 * 60_000,
  idleRoomTtlMs: 30 * 60_000,
  httpPerMinute: 120,
  messagesPerTenSeconds: 60,
  maxBufferedBytes: 65_536,
};
export type CreateRequest = {
  actorId: string;
  actionId: string;
  expectedVersion: 0;
};
export type JoinRequest = {
  actorId: string;
  actionId: string;
  roomId: string;
  code: string;
  expectedVersion: number;
};
const reconnectGraceMs = 40_000;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomService {
  onPeerDisconnect: (roomId: string, actorId: string) => void = () => undefined;
  onSessionDisconnect: (hash: string) => void = () => undefined;
  private stopped = false;
  private readonly rooms = new Map<string, Room>();
  private readonly codes = new Map<string, string>();
  private readonly memberships = new Map<string, string>();
  private readonly httpReceipts = new Map<
    string,
    {
      identity: Identity;
      records: Map<string, { fingerprint: string; descriptor: RoomDescriptor }>;
    }
  >();
  constructor(
    private readonly now: () => number,
    private readonly active: (identity: Identity) => boolean,
    private readonly limits: Limits,
    private readonly entropy: RandomInt = randomInt,
    private readonly storage?: MatchStorage,
  ) {
    const recoveryDeadline = this.now() + reconnectGraceMs;
    for (const state of storage?.loadActive(limits.maxRooms) ?? []) {
      if (
        new Set(state.members.map((member) => member.actorId)).size !== 4 ||
        this.codes.has(state.code) ||
        state.members.some(
          (member) => !member.departed && this.memberships.has(member.actorId),
        )
      )
        throw new Error('Conflicting saved OMI match memberships');
      const room: Room = {
        ...state,
        members: state.members.map((member) =>
          member.bot || state.ledger.final
            ? member
            : {
                ...member,
                disconnectDeadline:
                  member.disconnectDeadline ?? recoveryDeadline,
              },
        ),
        peers: new Map(),
        queue: new SerialQueue(limits.queueDepth),
        receipts: new Map(state.receipts),
      };
      this.rooms.set(room.id, room);
      this.codes.set(room.code, room.id);
      for (const member of room.members)
        if (!member.departed) this.memberships.set(member.actorId, room.id);
    }
  }
  statistics(actorId: string) {
    return this.storage?.statistics(actorId);
  }
  forActor(actorId: string): RoomDescriptor | null {
    const room = this.rooms.get(this.memberships.get(actorId) ?? '');
    return room ? this.descriptor(room) : null;
  }
  disconnectSession(hash: string): void {
    this.onSessionDisconnect(hash);
    for (const room of this.rooms.values())
      for (const peer of room.peers.values())
        if (peer.identity.tokenHash === hash) {
          this.onPeerDisconnect(room.id, peer.identity.actorId);
          peer.socket.close(1008, 'Logged out');
        }
  }
  async updateProfile(profile: PublicProfile): Promise<void> {
    const room = this.rooms.get(this.memberships.get(profile.id) ?? '');
    if (!room) return;
    await room.queue.run(() => {
      const member = room.members.find((item) => item.actorId === profile.id);
      if (!member) return;
      member.displayName = profile.displayName;
      member.avatarUrl = profile.thumbnailUrl ?? profile.googleAvatarUrl;
      this.advance(room, () => ({
        kind: 'member-updated',
        member: publicMember(room, member),
      }));
    }, true);
  }
  private descriptor(room: Room): RoomDescriptor {
    return {
      roomId: room.id,
      code: room.code,
      version: room.version,
      memberCount: room.members.length,
      invitePath: `/?room=${room.code}`,
    };
  }
  private checkIdentity(identity: Identity, actorId: string): void {
    if (this.stopped) throw new RoomError('SERVICE_STOPPING', 503);
    if (!this.active(identity)) throw new RoomError('SESSION_EXPIRED', 401);
    if (identity.actorId !== actorId)
      throw new RoomError('ACTOR_MISMATCH', 403);
  }
  private previousHttp(
    identity: Identity,
    actionId: string,
    fingerprint: string,
  ): RoomDescriptor | undefined {
    const prior = this.httpReceipts
      .get(identity.actorId)
      ?.records.get(actionId);
    if (!prior) return undefined;
    if (prior.fingerprint !== fingerprint)
      throw new RoomError('ACTION_ID_REUSED');
    if (!this.rooms.has(prior.descriptor.roomId))
      throw new RoomError('ROOM_EXPIRED', 410);
    return prior.descriptor;
  }
  private httpBudget(identity: Identity): void {
    if ((this.httpReceipts.get(identity.actorId)?.records.size ?? 0) >= 64)
      throw new RoomError('ACTION_BUDGET_EXHAUSTED', 429);
  }
  private rememberHttp(
    identity: Identity,
    actionId: string,
    fingerprint: string,
    descriptor: RoomDescriptor,
  ): RoomDescriptor {
    let bucket = this.httpReceipts.get(identity.actorId);
    if (!bucket) {
      bucket = { identity, records: new Map() };
      this.httpReceipts.set(identity.actorId, bucket);
    }
    bucket.records.set(actionId, { fingerprint, descriptor });
    return descriptor;
  }
  create(identity: Identity, request: CreateRequest): RoomDescriptor {
    this.checkIdentity(identity, request.actorId);
    const fingerprint = JSON.stringify({ kind: 'create', ...request });
    const prior = this.previousHttp(identity, request.actionId, fingerprint);
    if (prior) return prior;
    this.httpBudget(identity);
    this.sweep();
    if (this.memberships.has(identity.actorId))
      throw new RoomError('ALREADY_IN_ROOM');
    if (this.rooms.size >= this.limits.maxRooms)
      throw new RoomError('ROOM_CAPACITY', 503);
    let code: string;
    do {
      code = Array.from(
        { length: 8 },
        () => alphabet[randomInt(alphabet.length)],
      ).join('');
    } while (this.codes.has(code));
    const room: Room = {
      id: randomUUID(),
      code,
      hostId: identity.actorId,
      version: 0,
      members: [
        {
          actorId: identity.actorId,
          displayName: identity.displayName,
          seat: 0,
          ready: false,
          avatarUrl: identity.avatarUrl ?? null,
        },
      ],
      peers: new Map(),
      round: null,
      ledger: createLedger(),
      result: null,
      queue: new SerialQueue(this.limits.queueDepth),
      receipts: new Map(),
      lastActive: this.now(),
    };
    this.rooms.set(room.id, room);
    this.codes.set(code, room.id);
    this.memberships.set(identity.actorId, room.id);
    return this.rememberHttp(
      identity,
      request.actionId,
      fingerprint,
      this.descriptor(room),
    );
  }
  /** Synchronous all-or-nothing assignment; only server-authenticated queue identities. */
  match(identities: readonly Identity[]): RoomDescriptor {
    if (
      identities.length !== 4 ||
      new Set(identities.map((item) => item.actorId)).size !== 4
    )
      throw new RoomError('FOUR_PLAYERS_REQUIRED');
    for (const identity of identities) {
      this.checkIdentity(identity, identity.actorId);
      if (!identity.userId) throw new RoomError('LOGIN_REQUIRED', 401);
      if (this.forActor(identity.actorId))
        throw new RoomError('ALREADY_IN_ROOM');
    }
    const host = identities[0]!;
    const created = this.create(host, {
      actorId: host.actorId,
      actionId: randomUUID(),
      expectedVersion: 0,
    });
    const room = this.rooms.get(created.roomId)!;
    room.ranked = true;
    // No awaits between validation and membership installation: competing entries cannot interleave.
    room.members = identities.map((identity, seat) => ({
      actorId: identity.actorId,
      displayName: identity.displayName,
      seat: seat as Seat,
      ready: false,
      avatarUrl: identity.avatarUrl ?? null,
    }));
    for (const identity of identities)
      this.memberships.set(identity.actorId, room.id);
    return this.descriptor(room);
  }
  private connected(room: Room): boolean {
    return (
      room.members.length === 4 &&
      room.members.every((member) => {
        if (member.bot) return !room.ranked;
        const peer = room.peers.get(member.actorId);
        return (
          peer &&
          peer.socket.readyState === WebSocket.OPEN &&
          this.active(peer.identity)
        );
      })
    );
  }
  preview(identity: Identity, code: string): RoomDescriptor {
    this.checkIdentity(identity, identity.actorId);
    const room = this.rooms.get(this.codes.get(code) ?? '');
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 404);
    return this.descriptor(room);
  }
  join(identity: Identity, request: JoinRequest): Promise<RoomDescriptor> {
    this.checkIdentity(identity, request.actorId);
    const room = this.rooms.get(request.roomId);
    if (!room || room.code !== request.code)
      throw new RoomError('ROOM_NOT_FOUND', 404);
    const fingerprint = JSON.stringify({ kind: 'join', ...request });
    return room.queue.run(() => {
      this.checkIdentity(identity, request.actorId);
      const prior = this.previousHttp(identity, request.actionId, fingerprint);
      if (prior) return prior;
      this.httpBudget(identity);
      if (this.memberships.has(identity.actorId))
        throw new RoomError('ALREADY_IN_ROOM');
      if (request.expectedVersion !== room.version)
        throw new RoomError('VERSION_CONFLICT', 409, room.version);
      if (room.members.length === 4 || room.round)
        throw new RoomError('ROOM_FULL');
      const member: RoomMember = {
        actorId: identity.actorId,
        displayName: identity.displayName,
        seat: room.members.length as Seat,
        ready: false,
        avatarUrl: identity.avatarUrl ?? null,
      };
      room.members.push(member);
      this.memberships.set(identity.actorId, room.id);
      this.advance(room, () => ({
        kind: 'member-joined',
        member: publicMember(room, member),
      }));
      return this.rememberHttp(
        identity,
        request.actionId,
        fingerprint,
        this.descriptor(room),
      );
    });
  }
  authorize(
    roomId: string,
    identity: Identity,
  ): { room: Room; member: RoomMember } {
    this.checkIdentity(identity, identity.actorId);
    const room = this.rooms.get(roomId);
    const member = room?.members.find(
      (item) => item.actorId === identity.actorId && !item.departed,
    );
    if (!room || !member) throw new RoomError('ROOM_NOT_FOUND', 404);
    return { room, member };
  }
  getSnapshot(roomId: string, identity: Identity): Promise<Snapshot> {
    const { room } = this.authorize(roomId, identity);
    return room.queue.run(() => {
      const { member } = this.authorize(roomId, identity);
      return snapshot(room, member, null, true);
    });
  }
  attach(roomId: string, peer: Peer): Promise<void> {
    const { room } = this.authorize(roomId, peer.identity);
    return room.queue.run(() => {
      this.authorize(roomId, peer.identity);
      if (peer.socket.readyState !== WebSocket.OPEN) return;
      const old = room.peers.get(peer.identity.actorId);
      this.expireDisconnects(room);
      if (old) {
        room.peers.set(peer.identity.actorId, peer);
        this.onPeerDisconnect(roomId, peer.identity.actorId);
        old.socket.close(4001, 'Replaced by reconnect');
      } else {
        const members = room.members.map((item) => ({ ...item }));
        const member = members.find(
          (item) => item.actorId === peer.identity.actorId,
        )!;
        delete member.disconnectDeadline;
        member.bot = false;
        const peers = new Map(room.peers).set(peer.identity.actorId, peer);
        this.advance(
          { ...room, members, peers },
          () => ({
            kind: 'presence',
            seat: member.seat,
            connected: true,
            bot: false,
            disconnectDeadline: null,
          }),
          peer,
          room,
        );
      }
      room.lastActive = this.now();
      const member = room.members.find(
        (item) => item.actorId === peer.identity.actorId,
      )!;
      this.send(peer, snapshot(room, member, null, true));
    });
  }
  detach(roomId: string, peer: Peer): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.peers.get(peer.identity.actorId) !== peer)
      return Promise.resolve();
    const deadline = this.now() + reconnectGraceMs;
    return room.queue.run(() => {
      if (room.peers.get(peer.identity.actorId) !== peer) return;
      this.onPeerDisconnect(roomId, peer.identity.actorId);
      room.peers.delete(peer.identity.actorId);
      const member = room.members.find(
        (item) => item.actorId === peer.identity.actorId,
      )!;
      if (room.round && !room.ledger.final)
        member.disconnectDeadline = deadline;
      this.advance(room, () => ({
        kind: 'presence',
        seat: member.seat,
        connected: false,
        disconnectDeadline: member.disconnectDeadline ?? null,
      }));
    }, true);
  }
  /** State mutation, version validation and duplicate checks occur inside one serialized task. */
  command(roomId: string, peer: Peer, command: ClientCommand): Promise<void> {
    const { room } = this.authorize(roomId, peer.identity);
    return room.queue.run(() => {
      this.checkIdentity(peer.identity, command.actorId);
      const { member } = this.authorize(roomId, peer.identity);
      if (room.peers.get(peer.identity.actorId) !== peer)
        throw new RoomError('STALE_CONNECTION', 403);
      if (command.roomId !== roomId) throw new RoomError('ROOM_MISMATCH', 403);
      if (command.type === 'sync') {
        this.send(peer, snapshot(room, member, command.actionId, true));
        return;
      }
      const key = `${member.actorId}:${command.actionId}`;
      const fingerprint = JSON.stringify(command);
      const prior = room.receipts.get(key);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new RoomError('ACTION_ID_REUSED');
        this.send(
          peer,
          prior.reply.type === 'ack'
            ? { ...prior.reply, duplicate: true }
            : prior.reply,
        );
        return;
      }
      let used = 0;
      for (const id of room.receipts.keys())
        if (id.startsWith(`${member.actorId}:`)) used++;
      if (
        used >= this.limits.actionsPerMember &&
        command.type !== 'leave-match'
      )
        throw new RoomError('ACTION_BUDGET_EXHAUSTED', 429);
      let reply: Ack | Failure;
      try {
        this.expireDisconnects(room);
        if (command.expectedVersion !== room.version)
          throw new RoomError('VERSION_CONFLICT', 409, room.version);
        const draft: Room = {
          ...room,
          members: room.members.map((member) => ({ ...member })),
          receipts: new Map(room.receipts),
        };
        const actor = draft.members[member.seat]!;
        const event = this.apply(draft, actor, command);
        reply = {
          type: 'ack',
          roomId,
          actionId: command.actionId,
          version: room.version + 1,
          duplicate: false,
        };
        draft.receipts.set(key, { fingerprint, reply });
        this.advance(draft, event, undefined, room);
        if (command.type === 'leave-match') {
          this.memberships.delete(member.actorId);
          room.peers.delete(member.actorId);
          this.onPeerDisconnect(room.id, member.actorId);
        }
      } catch (error) {
        reply = {
          type: 'error',
          roomId,
          actionId: command.actionId,
          code:
            error instanceof RoomError
              ? error.code
              : error instanceof EngineError
                ? 'INVALID_GAME_ACTION'
                : 'INTERNAL_ERROR',
          version: room.version,
        };
      }
      room.receipts.set(key, { fingerprint, reply });
      this.send(peer, reply);
      if (reply.type === 'ack' && command.type === 'leave-match')
        peer.socket.close(1000, 'Match left');
    });
  }
  private apply(
    room: Room,
    member: RoomMember,
    command: Exclude<ClientCommand, { type: 'sync' }>,
  ): (recipient: RoomMember) => RoomEvent {
    if (command.type === 'leave-match') {
      if (!room.ledger.final) throw new RoomError('MATCH_IN_PROGRESS');
      member.departed = true;
      return () => ({ kind: 'presence', seat: member.seat, connected: false });
    }
    if (room.ledger.final) throw new RoomError('MATCH_COMPLETE');
    if (command.type === 'add-bot') {
      if (member.actorId !== room.hostId)
        throw new RoomError('HOST_REQUIRED', 403);
      if (room.ranked || room.round || room.members.length >= 4)
        throw new RoomError('BOT_NOT_ALLOWED');
      const seat = room.members.length as Seat;
      const bot = {
        actorId: randomUUID(),
        displayName: `Bot ${seat + 1}`,
        seat,
        ready: true,
        bot: true,
      };
      room.members.push(bot);
      return () => ({ kind: 'member-joined', member: publicMember(room, bot) });
    }
    if (command.type === 'ready') {
      if (room.round) throw new RoomError('ROUND_ALREADY_STARTED');
      member.ready = command.payload.ready;
      return () => ({ kind: 'ready', seat: member.seat, ready: member.ready });
    }
    if (command.type === 'start') {
      if (member.actorId !== room.hostId)
        throw new RoomError('HOST_REQUIRED', 403);
      if (room.round) throw new RoomError('ROUND_ALREADY_STARTED');
      if (!this.connected(room) || room.members.some((item) => !item.ready))
        throw new RoomError('FOUR_READY_PLAYERS_REQUIRED');
      room.round = createRound(
        randomUUID(),
        chooseInitialDealer(this.entropy),
        shuffleDeck(createDeck(), this.entropy),
      );
      const round = room.round;
      return () => ({
        kind: 'round-started',
        round: roundHeader(round),
        handCounts: handCounts(round),
      });
    }
    const previous = room.round;
    if (!previous) throw new RoomError('ROUND_NOT_STARTED');
    if (command.type === 'cut' || command.type === 'trump') {
      const round =
        command.type === 'cut'
          ? cutAndDeal(previous, member.seat, command.payload.offset)
          : selectTrump(previous, member.seat, command.payload.suit);
      room.round = round;
      return (recipient) => ({
        kind: 'cards-dealt',
        stage: command.type === 'cut' ? 'first' : 'second',
        round: roundHeader(round),
        hand: round.hands[recipient.seat].map(publicCard),
        handCounts: handCounts(round),
      });
    }
    if (command.type === 'play') {
      const round = playCard(previous, member.seat, command.payload.card);
      let ledger = room.ledger;
      let result = room.result;
      if (round.phase === 'complete') {
        const settlement = settleRound(round, ledger);
        if (settlement.status === 'settled') {
          ledger = settlement.ledger;
          result = {
            status: 'settled',
            outcome: settlement.result,
            tricks: countTricks(round),
          };
        }
      }
      room.round = round;
      room.ledger = ledger;
      room.result = result;
      const completed =
        round.tricks.length > previous.tricks.length
          ? publicTrick(round.tricks.at(-1)!)
          : null;
      return () => ({
        kind: 'card-played',
        seat: member.seat,
        card: publicCard(command.payload.card),
        turn: round.turn,
        phase: round.phase,
        handCounts: handCounts(round),
        completedTrick: completed,
        score: publicScore(ledger),
        result,
      });
    }
    if (command.type === 'accuse') {
      if (
        previous.phase !== 'playing' ||
        command.payload.playId >= previous.tricks.length * 4
      )
        throw new RoomError('REPORT_REJECTED');
      const result = accuse(
        previous,
        room.ledger,
        member.seat,
        command.payload.playId,
        () => 'eligible',
      );
      if (result.status === 'unresolved')
        throw new RoomError('UNRESOLVED_RULE');
      if (result.status === 'invalid') throw new RoomError('REPORT_REJECTED');
      if (result.status === 'already-applied')
        throw new RoomError('REPORT_ALREADY_APPLIED');
      room.ledger = result.ledger;
      room.round = { ...previous, phase: 'complete', turn: null };
      room.result = {
        status: 'settled',
        outcome: 'baldu',
        tricks: countTricks(previous),
      };
      const to = teamOf(member.seat);
      return () => ({
        kind: 'score-transferred',
        from: otherTeam(to),
        to,
        amount: 3,
        score: publicScore(result.ledger),
        result: room.result,
      });
    }
    if (command.type === 'report-no-trump') {
      if (!canRequestCancellation(previous, member.seat))
        throw new RoomError('REPORT_REJECTED');
      const round = restartCancelledRound(
        cancelRound(previous, member.seat),
        randomUUID(),
        shuffleDeck(createDeck(), this.entropy),
      );
      room.round = round;
      return () => ({
        kind: 'round-started',
        round: roundHeader(round),
        handCounts: handCounts(round),
        cancelledBy: member.seat,
      });
    }
    if (command.type === 'restart') {
      if (member.actorId !== room.hostId)
        throw new RoomError('HOST_REQUIRED', 403);
      if (previous.phase !== 'cancelled')
        throw new RoomError('ROUND_NOT_CANCELLED');
      if (!this.connected(room))
        throw new RoomError('FOUR_READY_PLAYERS_REQUIRED');
      const round = restartCancelledRound(
        previous,
        randomUUID(),
        shuffleDeck(createDeck(), this.entropy),
      );
      room.round = round;
      room.result = null;
      return () => ({
        kind: 'round-started',
        round: roundHeader(round),
        handCounts: handCounts(round),
      });
    }
    if (command.type === 'next-round') {
      if (member.actorId !== room.hostId)
        throw new RoomError('HOST_REQUIRED', 403);
      if (previous.phase !== 'complete')
        throw new RoomError('ROUND_NOT_COMPLETE');
      if (!room.result) throw new RoomError('ROUND_NOT_SETTLED');
      const dealer = nextSeat(previous.dealer);
      if (!this.connected(room))
        throw new RoomError('FOUR_READY_PLAYERS_REQUIRED');
      const round = createRound(
        randomUUID(),
        dealer,
        shuffleDeck(createDeck(), this.entropy),
      );
      room.round = round;
      room.result = null;
      return () => ({
        kind: 'round-started',
        round: roundHeader(round),
        handCounts: handCounts(round),
      });
    }
    throw new RoomError('INVALID_ACTION');
  }
  private advance(
    room: Room,
    event: (recipient: RoomMember) => RoomEvent,
    exclude?: Peer,
    commitTo: Room = room,
  ): void {
    const fromVersion = room.version;
    const lastActive = this.now();
    const committed = { ...room, version: fromVersion + 1, lastActive };
    if (committed.round) this.storage?.save(storedMatch(committed));
    Object.assign(commitTo, committed);
    room = commitTo;
    for (const member of room.members) {
      const peer = room.peers.get(member.actorId);
      if (peer && peer !== exclude)
        this.send(peer, {
          type: 'event',
          roomId: room.id,
          fromVersion,
          version: room.version,
          event: event(member),
        });
    }
  }
  send(peer: Peer, message: ServerMessage): void {
    if (peer.socket.readyState !== WebSocket.OPEN) return;
    // A silent socket can outlive its session until the next heartbeat.
    // Authorize each delivery, including recipient-specific private deals.
    if (!this.active(peer.identity)) {
      peer.socket.close(1008, 'Session expired');
      return;
    }
    const encoded = JSON.stringify(message);
    if (
      peer.socket.bufferedAmount + Buffer.byteLength(encoded) >
      this.limits.maxBufferedBytes
    ) {
      peer.socket.terminate();
      return;
    }
    peer.socket.send(encoded, (error) => {
      if (error) peer.socket.terminate();
    });
  }
  failure(
    peer: Peer,
    roomId: string,
    actionId: string | null,
    code: string,
  ): void {
    this.send(peer, { type: 'error', roomId, actionId, code, version: null });
  }
  private expireDisconnects(room: Room): void {
    if (!room.round || room.ledger.final) return;
    const now = this.now();
    const expired = room.members
      .filter(
        (member) =>
          !room.peers.has(member.actorId) &&
          member.disconnectDeadline !== undefined &&
          member.disconnectDeadline <= now,
      )
      .sort((a, b) => a.disconnectDeadline! - b.disconnectDeadline!);
    if (room.ranked && expired[0]) {
      const loser = teamOf(expired[0].seat);
      const simultaneous = expired.some(
        (member) =>
          member.disconnectDeadline === expired[0]!.disconnectDeadline &&
          teamOf(member.seat) !== loser,
      );
      const roundId = room.round.id;
      const ledger: ScoreLedger = {
        ...room.ledger,
        final: simultaneous
          ? { reason: 'double_forfeit', winner: null, loser: null, roundId }
          : {
              reason: 'ranked_forfeit',
              winner: otherTeam(loser),
              loser,
              roundId,
            },
      };
      const draft = {
        ...room,
        ledger,
        round: { ...room.round, phase: 'complete' as const, turn: null },
      };
      this.advance(
        draft,
        () => ({ kind: 'match-ended', score: publicScore(ledger) }),
        undefined,
        room,
      );
      return;
    }
    for (const member of expired) {
      const updated = { ...member, bot: true };
      delete updated.disconnectDeadline;
      const draft = {
        ...room,
        members: room.members.map((item) =>
          item.seat === member.seat ? updated : item,
        ),
      };
      this.advance(
        draft,
        () => ({
          kind: 'presence',
          seat: member.seat,
          connected: true,
          bot: true,
          disconnectDeadline: null,
        }),
        undefined,
        room,
      );
    }
  }
  tick(): void {
    for (const room of this.rooms.values()) {
      if (
        !room.round ||
        room.ledger.final ||
        this.stopped ||
        !room.members.some(
          (member) => member.bot || member.disconnectDeadline !== undefined,
        )
      )
        continue;
      void room.queue
        .run(() => {
          this.expireDisconnects(room);
          const round = room.round;
          if (
            !round ||
            room.ledger.final ||
            room.ranked ||
            room.peers.size === 0
          )
            return;
          const seat =
            round.phase === 'awaiting-cut'
              ? leftOf(round.dealer)
              : round.phase === 'awaiting-trump'
                ? round.selector
                : round.turn;
          const member = seat === null ? undefined : room.members[seat];
          if (!member?.bot || room.peers.has(member.actorId)) return;
          const envelope = {
            roomId: room.id,
            actorId: member.actorId,
            actionId: randomUUID(),
            expectedVersion: room.version,
          };
          let command: ClientCommand;
          if (round.phase === 'awaiting-cut') {
            command = { ...envelope, type: 'cut', payload: { offset: 16 } };
          } else if (round.phase === 'awaiting-trump') {
            const hand = round.hands[member.seat];
            const suit = [...hand].sort(
              (a, b) =>
                hand.filter((card) => card.suit === b.suit).length -
                hand.filter((card) => card.suit === a.suit).length,
            )[0]!.suit;
            command = { ...envelope, type: 'trump', payload: { suit } };
          } else {
            const hand = round.hands[member.seat];
            const lead = round.trick[0]?.card.suit;
            const following = hand.filter((card) => card.suit === lead);
            const legal = following.length ? following : hand;
            const card = [...legal].sort(
              (a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank),
            )[0]!;
            command = { ...envelope, type: 'play', payload: { card } };
          }
          const draft = { ...room };
          const event = this.apply(draft, member, command);
          this.advance(draft, event, undefined, room);
        })
        .catch(() => {
          // Leave committed state intact. A later tick can retry without double-settling.
        });
    }
  }
  heartbeat(): void {
    for (const room of this.rooms.values())
      for (const peer of room.peers.values()) {
        if (!this.active(peer.identity) || !peer.alive) peer.socket.terminate();
        else {
          peer.alive = false;
          peer.socket.ping();
        }
      }
    this.sweep();
  }
  sweep(): void {
    for (const [id, room] of this.rooms) {
      if (
        room.peers.size === 0 &&
        (!room.round || room.ledger.final) &&
        room.queue.pending === 0 &&
        this.now() - room.lastActive >= this.limits.idleRoomTtlMs
      ) {
        if (room.round) this.storage?.archive(id);
        this.rooms.delete(id);
        this.codes.delete(room.code);
        for (const member of room.members)
          if (this.memberships.get(member.actorId) === id)
            this.memberships.delete(member.actorId);
      }
    }
    for (const [actorId, bucket] of this.httpReceipts)
      if (!this.active(bucket.identity)) this.httpReceipts.delete(actorId);
  }
  stop(): void {
    this.stopped = true;
    for (const room of this.rooms.values())
      for (const peer of room.peers.values()) peer.socket.terminate();
    this.rooms.clear();
    this.codes.clear();
    this.memberships.clear();
    this.httpReceipts.clear();
  }
}
