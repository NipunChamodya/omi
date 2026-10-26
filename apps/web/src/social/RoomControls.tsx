import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { Member } from '@omi/shared';
import { SocialClient } from './client';
import SocialPanel from './SocialPanel';
const VoicePanel = lazy(() => import('../voice/VoicePanel'));
export default function RoomControls({
  roomId,
  actorId,
  members,
  online,
}: {
  roomId: string;
  actorId: string;
  members: readonly Member[];
  online: boolean;
}) {
  const [client] = useState(() => new SocialClient(roomId, actorId));
  const state = useStore(client.store);
  useEffect(() => () => client.stop(), [client]);
  useEffect(() => {
    client.setOnline(online);
  }, [client, online]);
  return (
    <>
      <Suspense fallback={<p role="status">Loading voice controls…</p>}>
        <VoicePanel
          roomId={roomId}
          actorId={actorId}
          members={members}
          online={online}
          blockedActorIds={state.preferences.blocked}
        />
      </Suspense>
      <SocialPanel client={client} members={members} />
    </>
  );
}
