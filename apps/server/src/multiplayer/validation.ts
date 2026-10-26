import { z } from 'zod';
const id = z.uuid();
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const envelope = {
  roomId: id,
  actorId: id,
  actionId: id,
  expectedVersion: version,
};
const empty = z.strictObject({});
const suit = z.enum(['spades', 'hearts', 'diamonds', 'clubs']);
const card = z.strictObject({
  suit,
  rank: z.enum(['A', 'K', 'Q', 'J', '10', '9', '8', '7']),
});
export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...envelope,
    type: z.literal('ready'),
    payload: z.strictObject({ ready: z.boolean() }),
  }),
  ...(
    ['start', 'sync', 'report-no-trump', 'restart', 'next-round'] as const
  ).map((type) =>
    z.strictObject({ ...envelope, type: z.literal(type), payload: empty }),
  ),
  z.strictObject({
    ...envelope,
    type: z.literal('cut'),
    payload: z.strictObject({ offset: z.number().int().min(1).max(31) }),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('trump'),
    payload: z.strictObject({ suit }),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('play'),
    payload: z.strictObject({ card }),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('accuse'),
    payload: z.strictObject({ playId: z.number().int().min(0).max(31) }),
  }),
]);
export const guestSchema = z.strictObject({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^\P{Cc}+$/u),
});
export const createSchema = z.strictObject({
  actorId: id,
  actionId: id,
  expectedVersion: z.literal(0),
});
export const joinSchema = z.strictObject({
  ...envelope,
  code: z.string().regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/),
});
export const roomIdSchema = id;
export const codeSchema = joinSchema.shape.code;
