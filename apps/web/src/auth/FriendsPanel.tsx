import { useState } from 'react';
import type { FriendAction, FriendContact } from '@omi/shared';
import { authApi } from './api';

export function FriendsPanel({
  actorId,
  csrf,
}: {
  actorId: string;
  csrf: string;
}) {
  const [contacts, setContacts] = useState<FriendContact[]>([]);
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'ready' | 'error'>(
    'idle',
  );

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
        if (event.currentTarget.open && state === 'idle') void run('list');
      }}
    >
      <summary>Friends</summary>
      <p className="quiet-note">Share your friend code with people you know.</p>
      <output className="friend-code">{actorId}</output>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run('request', code.trim());
        }}
        className="entry-form"
      >
        <label htmlFor="friend-code">Their friend code</label>
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
          Send request
        </button>
      </form>
      {state === 'error' && (
        <p role="alert">
          The friend action was unavailable. Check the code or try again.
        </p>
      )}
      {state === 'busy' && <p role="status">Updating friends…</p>}
      {state === 'ready' && contacts.length === 0 && (
        <p className="quiet-note">No friends or requests yet.</p>
      )}
      <ul className="friend-list" aria-label="Friend list">
        {contacts.map(({ id, displayName, status }) => (
          <li key={id}>
            <strong>{displayName}</strong>{' '}
            {status === 'sent' && <span>Request sent</span>}
            {status === 'incoming' && (
              <button
                type="button"
                className="text-button"
                disabled={state === 'busy'}
                onClick={() => void run('accept', id)}
              >
                Accept
              </button>
            )}
            {status === 'blocked' ? (
              <button
                type="button"
                className="text-button"
                disabled={state === 'busy'}
                onClick={() => void run('unblock', id)}
              >
                Unblock
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
                  Block
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
