import { GameRibbon } from '../components/GameChrome';
import '../components/adventure-chrome.css';
import '../components/adventure-surfaces.css';
import { useCopy } from '../i18n/locale';
import { ModerationPanel } from './ModerationPanel';
import { useEffect, useRef, useState } from 'react';
import type { AuthSession, PublicProfile, RoomDescriptor } from '@omi/shared';
import { FriendsPanel } from './FriendsPanel';
import { authApi, avatarSource } from './api';
import { ApiError } from '../game/api';
import { Avatar } from '../components/Cards';
function message(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'PROFILE_CONFLICT':
        return 'Your profile changed elsewhere. Review it before saving again.';
      case 'INVALID_AVATAR':
        return 'Choose a valid JPEG, PNG or WebP image, then adjust the crop.';
      case 'AVATAR_TOO_LARGE':
        return 'Choose an image smaller than 4 MB.';
      case 'UPLOAD_BUSY':
        return 'Photo uploads are busy. Please try again in a moment.';
      case 'AVATAR_STORAGE_UNAVAILABLE':
        return 'Photo uploads are not available right now.';
      case 'CSRF_REJECTED':
      case 'LOGIN_REQUIRED':
        return 'Your sign-in needs refreshing. Close this panel and sign in again.';
    }
  }
  return 'Could not save your profile. Please try again.';
}
export default function Profile({
  session,
  onClose,
  onUpdate,
  onRefresh,
  onLogout,
  canInvite,
  onRoom,
}: {
  session: AuthSession;
  onClose: () => void;
  onUpdate: (profile: PublicProfile) => void;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  canInvite: boolean;
  onRoom: (room: RoomDescriptor) => void;
}) {
  const user = session.user!;
  const stats = session.statistics;
  const text = useCopy();
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.displayName);
  const [busy, setBusy] = useState(false);
  const [confirmProtection, setConfirmProtection] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(task: () => Promise<PublicProfile>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      onUpdate(await task());
      setNotice(success);
      if (success === 'Photo saved.' || success === 'Photo removed.')
        setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      setError(text(message(error)));
      await onRefresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  const size = 1 / zoom;
  const side = Math.min(dimensions.width, dimensions.height) * size;
  const scale = side ? 200 / side : 1;
  return (
    <dialog
      className="profile-dialog"
      ref={dialog}
      aria-labelledby="profile-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="profile-heading">
        <div>
          <p className="eyebrow">{text('YOUR PLACE AT THE TABLE')}</p>
          <GameRibbon id="profile-title">{text('Your profile')}</GameRibbon>
          {stats && (
            <section
              aria-label={text('Match statistics')}
              className="quiet-note"
            >
              <p>
                {stats.played} played · {stats.wins} won ·{' '}
                {stats.played - stats.wins} lost
                {stats.played > 0 &&
                  ` · ${Math.round((stats.wins * 100) / stats.played)}% win rate`}
              </p>
              <p>
                {stats.casualWins} casual wins · {stats.rankedWins} ranked wins
                · {stats.loanLosses} loan losses · {stats.rankedForfeitLosses}{' '}
                ranked forfeit losses
              </p>
              {stats.experimentalRating && (
                <details>
                  <summary>
                    Experimental Elo · {stats.experimentalRating.rating}
                  </summary>
                  <p>
                    Local trial. Each team’s average rating sets its expected
                    result. Both teammates receive the adjustment. Double
                    forfeits leave ratings unchanged.
                  </p>
                  <ul aria-label={text('Recent rating changes')}>
                    {stats.experimentalRating.history.map((entry, index) => (
                      <li key={index}>
                        {entry.previous} → {entry.rating}
                      </li>
                    ))}
                  </ul>
                  <ol aria-label={text('Experimental leaderboard')}>
                    {stats.experimentalRating.leaders.map((entry, index) => (
                      <li key={index}>
                        {entry.name} · {entry.rating}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {!!stats.partnerships?.length && (
                <details>
                  <summary>{text('Partnerships')}</summary>
                  <ul>
                    {stats.partnerships.map((partner, index) => (
                      <li key={index}>
                        {partner.name} · {partner.wins} wins in{' '}
                        {partner.matches} matches
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!!stats.recent.length && (
                <details>
                  <summary>{text('Recent matches')}</summary>
                  <ul>
                    {stats.recent.map((match, index) => (
                      <li key={index}>
                        {new Date(match.completedAt).toLocaleDateString()} ·{' '}
                        {match.ranked ? 'Ranked' : 'Casual'} ·{' '}
                        {match.won ? 'Won' : 'Lost'}
                        {match.reason === 'loan_loss'
                          ? ' · Loan loss'
                          : match.reason === 'double_forfeit'
                            ? ' · Double forfeit'
                            : match.reason === 'ranked_forfeit'
                              ? ' · Forfeit'
                              : ''}
                        {!!match.hands?.length && (
                          <details>
                            <summary>
                              {match.hands.length} settled hands
                            </summary>
                            <ol>
                              {match.hands.map((hand, index) => (
                                <li key={index}>
                                  {hand.outcome} · {hand.tricks[0]}–
                                  {hand.tricks[1]} tricks
                                </li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </div>
        <button
          type="button"
          className="text-button"
          aria-label={text('Close profile')}
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ← {text('Back')}
        </button>
      </div>
      {error && (
        <p role="alert" className="profile-feedback">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="profile-feedback success">
          {notice}
        </p>
      )}
      <div className="profile-current">
        <Avatar
          name={user.displayName}
          src={avatarSource(user.avatarUrl ?? user.googleAvatarUrl)}
          teammate
        />
        <div>
          <strong>{user.displayName}</strong>
          <small>{text('Signed in with Google')}</small>
        </div>
      </div>
      <form
        className="entry-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save(
            () => authApi.rename(name.trim(), user.version, session.csrfToken!),
            'Name saved.',
          );
        }}
      >
        <label htmlFor="profile-name">{text('Display name')}</label>
        <input
          id="profile-name"
          required
          maxLength={32}
          autoComplete="nickname"
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          className="button secondary"
          disabled={busy || !name.trim() || name.trim() === user.displayName}
        >
          {text('Save name')}
        </button>
      </form>
      <section className="photo-editor" aria-labelledby="photo-title">
        <h3 id="photo-title">{text('Profile photo')}</h3>
        <p>{text('Choose from your gallery, then frame it your way.')}</p>
        {session.avatarUploadsEnabled && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {text('Edit avatar')}
          </button>
        )}
        <input
          ref={fileInput}
          className="file-input"
          aria-label={text('Choose profile photo')}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || !session.avatarUploadsEnabled}
          onChange={(event) => {
            const next = event.target.files?.[0];
            setError('');
            setNotice('');
            if (next && next.size > 4 * 1024 * 1024) {
              setError('Choose an image smaller than 4 MB.');
              event.target.value = '';
              return;
            }
            setDimensions({ width: 0, height: 0 });
            setX(50);
            setY(50);
            setZoom(1);
            setFile(next ?? null);
          }}
        />
        {!session.avatarUploadsEnabled && (
          <p className="quiet-note">
            {text('Photo uploads are not available right now.')}
          </p>
        )}
        {file && preview && (
          <>
            <div className="crop-frame" aria-label={text('Photo crop preview')}>
              <img
                src={preview}
                alt="Your selected crop"
                draggable={false}
                onLoad={(event) =>
                  setDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
                onError={() => {
                  setDimensions({ width: 0, height: 0 });
                  setError(
                    'This image could not be opened. Choose a JPEG, PNG or WebP image.',
                  );
                }}
                style={{
                  width: dimensions.width ? dimensions.width * scale : 200,
                  height: dimensions.height ? dimensions.height * scale : 200,
                  left: ((-(dimensions.width - side) * x) / 100) * scale,
                  top: ((-(dimensions.height - side) * y) / 100) * scale,
                }}
              />
            </div>
            <label className="crop-control">
              {text('Zoom')}
              <input
                type="range"
                aria-label={text('Zoom')}
                min={1}
                max={4}
                step={0.1}
                value={zoom}
                disabled={busy}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <label className="crop-control">
              {text('Horizontal position')}
              <input
                type="range"
                aria-label={text('Horizontal position')}
                min={0}
                max={100}
                value={x}
                disabled={busy}
                onChange={(event) => setX(Number(event.target.value))}
              />
            </label>
            <label className="crop-control">
              {text('Vertical position')}
              <input
                type="range"
                aria-label={text('Vertical position')}
                min={0}
                max={100}
                value={y}
                disabled={busy}
                onChange={(event) => setY(Number(event.target.value))}
              />
            </label>
            <div className="photo-actions">
              <button
                className="button primary"
                type="button"
                disabled={busy || !dimensions.width}
                onClick={() =>
                  void save(
                    () =>
                      authApi.upload(
                        file,
                        { x: x / 100, y: y / 100, size },
                        user.version,
                        session.csrfToken!,
                      ),
                    'Photo saved.',
                  )
                }
              >
                {busy ? 'Saving…' : 'Save photo'}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = '';
                }}
              >
                {text('Cancel photo')}
              </button>
            </div>
          </>
        )}
        {user.avatarUrl && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() =>
              void save(
                () => authApi.remove(user.version, session.csrfToken!),
                'Photo removed.',
              )
            }
          >
            {text('Remove custom photo')}
          </button>
        )}
        <p className="quiet-note">
          JPEG, PNG or WebP · up to 4 MB. Location and camera metadata are
          removed.
        </p>
      </section>
      <button
        className="button secondary logout-button"
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onLogout().catch((error) => {
            setError(text(message(error)));
            setBusy(false);
          });
        }}
      >
        {text('Sign out')}
      </button>
      <section aria-label={text('Protected play')}>
        <p>
          {text(
            session.protectedPlay
              ? 'Protected play is on.'
              : 'Protected play turns off chat, voice, invitations, and sponsor messages for this account.',
          )}
        </p>
        {session.csrfToken && !session.protectedPlay && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              if (!confirmProtection) {
                setConfirmProtection(true);
                return;
              }
              setBusy(true);
              try {
                await authApi.protect(session.csrfToken!);
                await onRefresh();
                setConfirmProtection(false);
              } catch (error) {
                setError(text(message(error)));
              } finally {
                setBusy(false);
              }
            }}
          >
            {text(
              confirmProtection
                ? 'Confirm protected play (cannot be turned off here)'
                : 'Enable protected play',
            )}
          </button>
        )}
      </section>
      {session.csrfToken && (
        <FriendsPanel
          actorId={user.id}
          csrf={session.csrfToken}
          allowRequests={
            !session.protectedPlay && !session.communicationRestricted
          }
          canInvite={
            canInvite &&
            !session.protectedPlay &&
            !session.communicationRestricted
          }
          onRoom={onRoom}
        />
      )}
      {session.canModerate && session.csrfToken && (
        <ModerationPanel csrf={session.csrfToken} />
      )}
    </dialog>
  );
}
