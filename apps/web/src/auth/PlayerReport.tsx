import { useId, useState } from 'react';
import type { Snapshot } from '@omi/shared';
import { useCopy } from '../i18n/locale';
import { authApi } from './api';

const reasons = {
  unfriendly: 'Unfriendly behavior',
  unsafe: 'Something felt unsafe',
  other: 'Something else',
} as const;

export default function PlayerReport({
  csrf,
  snapshot,
}: {
  csrf: string;
  snapshot: Snapshot;
}) {
  const text = useCopy();
  const id = useId();
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState<keyof typeof reasons>('unfriendly');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle',
  );
  const players = snapshot.members.filter(
    (member) => !member.bot && member.actorId !== snapshot.you.actorId,
  );
  if (players.length === 0) return null;
  return (
    <details className="player-report">
      <summary>{text('Report a player')}</summary>
      <form
        className="entry-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            status === 'sending' ||
            !players.some((player) => player.actorId === subject)
          )
            return;
          setStatus('sending');
          try {
            await authApi.reportPlayer(snapshot.roomId, subject, reason, csrf);
            setSubject('');
            setStatus('sent');
          } catch {
            setStatus('failed');
          }
        }}
      >
        <label htmlFor={id + '-player'}>
          {text('Who are you worried about?')}
        </label>
        <select
          id={id + '-player'}
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        >
          <option value="">{text('Choose a player')}</option>
          {players.map((player) => (
            <option key={player.actorId} value={player.actorId}>
              {player.displayName}
            </option>
          ))}
        </select>
        <label htmlFor={id + '-reason'}>{text('What happened?')}</label>
        <select
          id={id + '-reason'}
          value={reason}
          onChange={(event) =>
            setReason(event.target.value as keyof typeof reasons)
          }
        >
          {(Object.keys(reasons) as (keyof typeof reasons)[]).map((value) => (
            <option key={value} value={value}>
              {text(reasons[value])}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="button secondary"
          disabled={!subject || status === 'sending'}
        >
          {text('Send private report')}
        </button>
        {status === 'sent' && (
          <p role="status">{text('Your report was sent privately.')}</p>
        )}
        {status === 'failed' && (
          <p role="alert">
            {text('Could not send your report. Try again later.')}
          </p>
        )}
      </form>
    </details>
  );
}
