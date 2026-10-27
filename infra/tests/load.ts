// Private loopback benchmark only. Never imports or starts a public identity provider.
import { randomUUID } from 'node:crypto';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { buildApp } from '../../apps/server/src/app.js';
import { parseConfig } from '../../apps/server/src/config.js';
import { applyEvent } from '../../apps/web/src/game/reducer';
import type {
  Ack,
  ClientCommand,
  GuestIdentity,
  RoomDescriptor,
  ServerMessage,
  Snapshot,
} from '@omi/shared';
const rooms = Number(process.argv[2] ?? 8),
  seconds = Number(process.argv[3] ?? 30);
if (
  !Number.isInteger(rooms) ||
  rooms < 1 ||
  rooms > 8 ||
  !Number.isInteger(seconds) ||
  seconds < 1 ||
  seconds > 120
)
  throw new Error('Usage: test:load -- rooms(1..8) idle-soak-seconds(1..120)');
const origin = 'http://127.0.0.1:5173';
const app = buildApp({
  logger: false,
  config: parseConfig({
    NODE_ENV: 'test',
    ALLOW_GUESTS: 'true',
    DATABASE_PATH: ':memory:',
    APP_ORIGIN: origin,
  }),
});
const sockets: WebSocket[] = [],
  latency: number[] = [];
const loop = monitorEventLoopDelay({ resolution: 20 });
let peakRss = process.memoryUsage().rss,
  actions = 0,
  privateChecks = 0,
  duplicates = 0,
  reconnects = 0;
const sample = setInterval(
  () => (peakRss = Math.max(peakRss, process.memoryUsage().rss)),
  100,
);
sample.unref();
loop.enable();
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function privacy(value: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(
      ![
        'deck',
        'hands',
        'originalHands',
        'violations',
        'cheatingHistory',
        'ledger',
        'tokenHash',
        'csrfToken',
      ].includes(key),
      'Private field reached wire',
    );
    privacy(child);
  }
}
class Client {
  state?: Snapshot;
  failure?: Error;
  checks = new Set<() => void>();
  replies = new Map<string, (ack: Ack) => void>();
  constructor(
    readonly socket: WebSocket,
    readonly identity: GuestIdentity,
    readonly cookie: string,
    readonly roomId: string,
  ) {
    sockets.push(socket);
    socket.on('error', () => {
      this.failure = new Error('Socket failed');
      for (const check of this.checks) check();
    });
    socket.on('message', (bytes) => {
      try {
        const message = JSON.parse(bytes.toString()) as ServerMessage;
        privacy(message);
        privateChecks++;
        if (message.type === 'error')
          throw new Error(`Action failed: ${message.code}`);
        if (message.type === 'snapshot') {
          assert(message.you.actorId === identity.actorId, 'Wrong recipient');
          this.state = message;
        }
        if (message.type === 'event') {
          assert(this.state, 'Missing initial snapshot');
          const next = applyEvent(this.state, message);
          assert(next, 'Version gap');
          this.state = next;
          if (message.event.kind === 'card-played')
            assert(
              !('hand' in message.event),
              'Ordinary play disclosed a hand',
            );
        }
        if (message.type === 'ack')
          this.replies.get(message.actionId)?.(message);
      } catch (error) {
        this.failure =
          error instanceof Error ? error : new Error('Wire validation failed');
      }
      for (const check of this.checks) check();
    });
  }
  until(predicate: () => boolean) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.checks.delete(check);
        reject(new Error('State timeout'));
      }, 5000);
      const check = () => {
        if (this.failure || predicate()) {
          clearTimeout(timer);
          this.checks.delete(check);
          if (this.failure) reject(this.failure);
          else resolve();
        }
      };
      this.checks.add(check);
      check();
    });
  }
  async send(type: ClientCommand['type'], payload: unknown, replay?: object) {
    assert(this.state, 'No state');
    const command = replay ?? {
      roomId: this.roomId,
      actorId: this.identity.actorId,
      actionId: randomUUID(),
      expectedVersion: this.state.version,
      type,
      payload,
    };
    const actionId = (command as { actionId: string }).actionId;
    const start = performance.now();
    let ack: Ack | undefined;
    this.replies.set(actionId, (result) => (ack = result));
    this.socket.send(JSON.stringify(command));
    try {
      await this.until(() => Boolean(ack));
    } finally {
      this.replies.delete(actionId);
    }
    latency.push(performance.now() - start);
    actions++;
    return { command, ack: ack! };
  }
}
let base = '';
async function post(path: string, payload: object, cookie?: string) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
  assert(response.ok, `HTTP failure ${response.status} at ${path}`);
  return response;
}
async function connect(
  identity: GuestIdentity,
  cookie: string,
  roomId: string,
) {
  const socket = new WebSocket(
    `${base.replace(/^http/, 'ws')}/rooms/${roomId}/ws`,
    { headers: { origin, cookie } },
  );
  const client = new Client(socket, identity, cookie, roomId);
  await client.until(() => Boolean(client.state));
  return client;
}
async function round() {
  const people: { identity: GuestIdentity; cookie: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const response = await post('/transport/session', {
      displayName: `Load player ${i}`,
    });
    const identity = (await response.json()) as GuestIdentity;
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    people.push({ identity, cookie });
  }
  const host = people[0]!;
  let descriptor = (await (
    await post(
      '/rooms',
      {
        actorId: host.identity.actorId,
        actionId: randomUUID(),
        expectedVersion: 0,
      },
      host.cookie,
    )
  ).json()) as RoomDescriptor;
  for (const person of people.slice(1))
    descriptor = (await (
      await post(
        '/rooms/join',
        {
          actorId: person.identity.actorId,
          actionId: randomUUID(),
          expectedVersion: descriptor.version,
          roomId: descriptor.roomId,
          code: descriptor.code,
        },
        person.cookie,
      )
    ).json()) as RoomDescriptor;
  const clients: Client[] = [];
  for (const person of people)
    clients.push(
      await connect(person.identity, person.cookie, descriptor.roomId),
    );
  const sync = async (version: number) =>
    Promise.all(
      clients.map((client) =>
        client.until(() => (client.state?.version ?? -1) >= version),
      ),
    );
  await sync(clients[3]!.state!.version);
  async function act(
    index: number,
    type: ClientCommand['type'],
    payload: unknown,
  ) {
    const result = await clients[index]!.send(type, payload);
    await sync(result.ack.version);
    return result;
  }
  const ready = await act(0, 'ready', { ready: true });
  const replay = await clients[0]!.send('ready', {}, ready.command);
  assert(
    replay.ack.duplicate && replay.ack.version === ready.ack.version,
    'Duplicate applied twice',
  );
  duplicates++;
  for (let i = 1; i < 4; i++) await act(i, 'ready', { ready: true });
  await act(0, 'start', {});
  const dealer = clients[0]!.state!.game!.dealer;
  await act((dealer + 3) % 4, 'cut', { offset: 16 });
  const selector = clients[0]!.state!.game!.selector;
  await act(selector, 'trump', {
    suit: clients[selector]!.state!.game!.hand[0]!.suit,
  });
  const hands = clients.flatMap((client) =>
    client.state!.game!.hand.map((card) => `${card.suit}:${card.rank}`),
  );
  assert(
    hands.length === 32 && new Set(hands).size === 32,
    'Private deals were not disjoint',
  );
  const before = clients[2]!.state!.game!.hand;
  clients[2]!.socket.terminate();
  clients[2] = await connect(
    people[2]!.identity,
    people[2]!.cookie,
    descriptor.roomId,
  );
  assert(
    JSON.stringify(clients[2]!.state!.game!.hand) === JSON.stringify(before),
    'Reconnect lost private hand',
  );
  reconnects++;
  await sync(clients[2]!.state!.version);
  for (let i = 0; i < 32; i++) {
    const turn = clients[0]!.state!.game!.turn!;
    const game = clients[turn]!.state!.game!;
    const lead = game.trick[0]?.card.suit;
    const card = game.hand.find((card) => card.suit === lead) ?? game.hand[0]!;
    await act(turn, 'play', { card });
  }
  assert(
    clients.every(
      (client) =>
        client.state?.game?.phase === 'complete' &&
        client.state.game.tricks.length === 8 &&
        client.state.game.hand.length === 0,
    ),
    'Round did not finish',
  );
  return clients;
}
const started = performance.now();
try {
  base = await app.listen({ host: '127.0.0.1', port: 0 });
  const groups = await Promise.all(
    Array.from({ length: rooms }, () => round()),
  );
  for (let second = 0; second < seconds; second++) {
    await Promise.all(
      groups.flat().map(
        (client) =>
          new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error('Pong timeout')),
              3000,
            );
            client.socket.once('pong', () => {
              clearTimeout(timer);
              resolve();
            });
            client.socket.ping();
          }),
      ),
    );
    await pause(1000);
  }
  latency.sort((a, b) => a - b);
  const p95 = latency[Math.floor(latency.length * 0.95)]!;
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  assert(p95 < 250, 'Local action p95 exceeded 250ms');
  assert(
    peakRss < 512 * 1024 * 1024,
    'Combined benchmark process exceeded 512MiB RSS',
  );
  console.log(
    JSON.stringify(
      {
        scope: 'loopback backend plus Node clients; no OIDC/browser/voice load',
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        rooms,
        players: rooms * 4,
        completedRounds: groups.length,
        actions,
        duplicateChecks: duplicates,
        reconnects,
        privateWireChecks: privateChecks,
        idleSoakSeconds: seconds,
        durationSeconds: Math.round((performance.now() - started) / 1000),
        actionP50Ms: Number(
          latency[Math.floor(latency.length * 0.5)]!.toFixed(2),
        ),
        actionP95Ms: Number(p95.toFixed(2)),
        eventLoopP99Ms: Number((loop.percentile(99) / 1e6).toFixed(2)),
        peakCombinedRssMiB: Number((peakRss / 1024 / 1024).toFixed(1)),
      },
      null,
      2,
    ),
  );
} finally {
  clearInterval(sample);
  loop.disable();
  for (const socket of sockets) socket.terminate();
  await app.close();
}
