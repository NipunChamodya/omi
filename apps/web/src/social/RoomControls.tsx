import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { Member } from '@omi/shared';
import { useCopy } from '../i18n/locale';
import { useDataSaver } from '../pwa/preferences';
import { SocialClient } from './client';
import SocialPanel from './SocialPanel';
const LocalMusic = lazy(() => import('./LocalMusic'));
const VoicePanel = lazy(() => import('../voice/VoicePanel'));
export default function RoomControls({
  roomId,
  actorId,
  hostId,
  members,
  online,
}: {
  roomId: string;
  actorId: string;
  hostId: string;
  members: readonly Member[];
  online: boolean;
}) {
  const [client] = useState(() => new SocialClient(roomId, actorId));
  const text = useCopy();
  const saver = useDataSaver((state) => state.enabled);
  useEffect(() => {
    if (saver) {
      client.disableMusic();
      client.disableEffects();
    }
  }, [client, saver]);
  const state = useStore(client.store);
  useEffect(() => () => client.stop(), [client]);
  useEffect(() => {
    client.setOnline(online);
  }, [client, online]);
  return (
    <>
      <Suspense
        fallback={
          <p role="status" id="table-live-voice" tabIndex={-1}>
            {text('Loading room controls…')}
          </p>
        }
      >
        <VoicePanel
          roomId={roomId}
          actorId={actorId}
          members={members}
          online={online}
          blockedActorIds={state.preferences.blocked}
        />
      </Suspense>
      {!saver && (
        <Suspense fallback={null}>
          <LocalMusic
            key={hostId}
            roomId={roomId}
            actorId={actorId}
            hostId={hostId}
            online={online}
            blocked={state.preferences.blocked.includes(hostId)}
          />
        </Suspense>
      )}
      <SocialPanel client={client} members={members} />
    </>
  );
}
