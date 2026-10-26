import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type { VoiceConfig } from '@omi/shared';
const urls = (schemes: string[]) =>
  z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .refine(
      (values) =>
        values.length <= 4 &&
        values.every((value) => {
          const match =
            /^(stuns?|turns?):(?:\[[a-fA-F0-9:]+\]|[a-zA-Z0-9][a-zA-Z0-9.-]*)(?::([0-9]{1,5}))?(?:\?transport=(udp|tcp))?$/.exec(
              value,
            );
          return (
            value.length <= 256 &&
            match &&
            schemes.includes(match[1]!) &&
            (!match[2] || (Number(match[2]) > 0 && Number(match[2]) <= 65535))
          );
        }),
      'Invalid ICE server URLs',
    );
export const voiceFields = {
  VOICE_STUN_URLS: urls(['stun', 'stuns']),
  VOICE_TURN_URLS: urls(['turn', 'turns']),
  VOICE_TURN_SECRET: z.string().min(32).max(256).optional(),
  VOICE_ICE_POLICY: z.enum(['all', 'relay']).default('all'),
};
export type IceSettings = {
  VOICE_STUN_URLS: string[];
  VOICE_TURN_URLS: string[];
  VOICE_TURN_SECRET?: string | undefined;
  VOICE_ICE_POLICY: 'all' | 'relay';
};
export function iceConfiguration(
  settings: IceSettings,
  actorId: string,
  now: number,
): VoiceConfig {
  const expiresAt = now + 60 * 60_000;
  const iceServers: VoiceConfig['iceServers'] = [];
  if (settings.VOICE_STUN_URLS.length)
    iceServers.push({ urls: settings.VOICE_STUN_URLS });
  if (settings.VOICE_TURN_URLS.length && settings.VOICE_TURN_SECRET) {
    const username = `${Math.floor(expiresAt / 1000)}:${actorId}`;
    iceServers.push({
      urls: settings.VOICE_TURN_URLS,
      username,
      credential: createHmac('sha1', settings.VOICE_TURN_SECRET)
        .update(username)
        .digest('base64'),
    });
  }
  return {
    iceServers,
    iceTransportPolicy: settings.VOICE_ICE_POLICY,
    expiresAt,
    relayAvailable: settings.VOICE_TURN_URLS.length > 0,
  };
}
