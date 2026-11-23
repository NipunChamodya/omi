import { useCopy } from '../i18n/locale';
import { useState } from 'react';
import type {
  FriendAction,
  FriendContact,
  RoomInvitation,
  RoomDescriptor,
} from '@omi/shared';
import { authApi } from './api';

export function FriendsPanel({
  actorId,
  csrf,
  canInvite,
  allowRequests,
  onRoom,
}: {
  actorId: string;
  csrf: string;
  canInvite: boolean;
  allowRequests: boolean;
  onRoom: (room: RoomDescriptor) => void;
}) {
  const [contacts, setContacts] = useState<FriendContact[]>([]);
  const [code, setCode] = useState('');
  const text = useCopy();
  const [state, setState] = useState<'idle' | 'busy' | 'ready' | 'error'>(
    'idle',
  );

  const [invites, setInvites] = useState<RoomInvitation[]>([]);
  const [inviteStatus, setInviteStatus] = useState('');
  const [inviting, setInviting] = useState(false);
  async function invite(action: Parameters<typeof authApi.invitations>[0]) {
    setInviting(true);
    setInviteStatus('');
    try {
      const response = await authApi.invitations(action, csrf);
      setInvites(response.invitations);
      if (response.room) onRoom(response.room);
      if (action.action === 'send') setInviteStatus('Invitation sent.');
    } catch {
      setInviteStatus('This invitation is unavailable. Refresh to try again.');
    } finally {
      setInviting(false);
    }
  }

  async function run(action: FriendAction | 'list', target?: string) {
    setState('busy');
    try {
      const response = await authApi.friends(
        action === 'list' ? { action } : { action, target: target! },
        csrf,
      );
      setContacts(response.friends);
      if (action === 'request') setCode('');
      setState('ready');
    } catch {
      setState('error');
    }
  }

  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) {
          if (state === 'idle') void run('list');
          if (allowRequests) void invite({ action: 'list' });
        }
      }}
    >
      <summary>{text('Friends')}</summary>
      {allowRequests && (
        <>
          <button
            type="button"
            className="text-button"
            disabled={inviting}
            onClick={() => void invite({ action: 'list' })}
          >
            Refresh invitations
          </button>
          {inviteStatus && <p role="status">{inviteStatus}</p>}
          {invites.length > 0 && (
            <ul aria-label={text('Table invitations')}>
              {invites.map((item) => (
                <li key={item.id}>
                  {item.senderName} invited you{' '}
                  {item.partnership ? 'as their teammate' : 'to their table'}.{' '}
                  <button
                    type="button"
                    className="text-button"
                    disabled={inviting}
                    onClick={() =>
                      void invite({
                        action: 'respond',
                        id: item.id,
                        accept: true,
                      })
                    }
                  >
                    Join table
                  </button>{' '}
                  <button
                    type="button"
                    className="text-button"
                    disabled={inviting}
                    onClick={() =>
                      void invite({
                        action: 'respond',
                        id: item.id,
                        accept: false,
                      })
                    }
                  >
                    Decline
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="quiet-note">
            {text('Share your friend code with people you know.')}
          </p>
          <output className="friend-code">{actorId}</output>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run('request', code.trim());
            }}
            className="entry-form"
          >
            <label htmlFor="friend-code">{text('Their friend code')}</label>
            <input
              id="friend-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={36}
              required
            />
            <button
              type="submit"
              className="button secondary"
              disabled={state === 'busy'}
            >
              {text('Send request')}
            </button>
          </form>
        </>
      )}
      {state === 'error' && (
        <p role="alert">
          {text(
            'The friend action was unavailable. Check the code or try again.',
          )}
        </p>
      )}
      {state === 'busy' && <p role="status">{text('Updating friends…')}</p>}
      {state === 'ready' && contacts.length === 0 && (
        <p className="quiet-note">{text('No friends or requests yet.')}</p>
      )}
      <ul className="friend-list" aria-label={text('Friend list')}>
        {contacts.map(({ id, displayName, status }) => (
          <li key={id}>
            <strong>{displayName}</strong>{' '}
            {canInvite && status === 'accepted' && (
              <>
                <button
                  type="button"
                  className="text-button"
                  disabled={inviting}
                  onClick={() =>
                    void invite({
                      action: 'send',
                      target: id,
                      partnership: false,
                    })
                  }
                >
                  Invite to table
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={inviting}
                  onClick={() =>
                    void invite({
                      action: 'send',
                      target: id,
                      partnership: true,
                    })
                  }
                >
                  Invite as teammate
                </button>
              </>
            )}
            {status === 'sent' && <span>{text('Request sent')}</span>}
            {allowRequests && status === 'incoming' && (
              <button
                type="button"
                className="text-button"
                disabled={state === 'busy'}
                onClick={() => void run('accept', id)}
              >
                {text('Accept')}
              </button>
            )}
            {status === 'blocked' ? (
              <button
                type="button"
                className="text-button"
                disabled={state === 'busy'}
                onClick={() => void run('unblock', id)}
              >
                {text('Unblock')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="text-button"
                  disabled={state === 'busy'}
                  onClick={() => void run('remove', id)}
                >
                  {status === 'incoming'
                    ? 'Reject'
                    : status === 'sent'
                      ? 'Cancel request'
                      : 'Remove'}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={state === 'busy'}
                  onClick={() => void run('block', id)}
                >
                  {text('Block')}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
