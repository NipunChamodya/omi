import { useEffect, useRef, useState } from 'react';
import type { AuthSession, PublicProfile } from '@omi/shared';
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
}: {
  session: AuthSession;
  onClose: () => void;
  onUpdate: (profile: PublicProfile) => void;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const user = session.user!;
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.displayName);
  const [busy, setBusy] = useState(false);
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
      setError(message(error));
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
          <p className="eyebrow">YOUR PLACE AT THE TABLE</p>
          <h2 id="profile-title">Your profile</h2>
        </div>
        <button
          type="button"
          className="text-button"
          aria-label="Close profile"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          ×
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
          <small>Signed in with Google</small>
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
        <label htmlFor="profile-name">Display name</label>
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
          Save name
        </button>
      </form>
      <section className="photo-editor" aria-labelledby="photo-title">
        <h3 id="photo-title">Profile photo</h3>
        <p>Choose from your gallery, then frame it your way.</p>
        <input
          ref={fileInput}
          className="file-input"
          aria-label="Choose profile photo"
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
            Photo uploads are not available right now.
          </p>
        )}
        {file && preview && (
          <>
            <div className="crop-frame" aria-label="Photo crop preview">
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
              Zoom
              <input
                type="range"
                aria-label="Zoom"
                min={1}
                max={4}
                step={0.1}
                value={zoom}
                disabled={busy}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
            <label className="crop-control">
              Horizontal position
              <input
                type="range"
                aria-label="Horizontal position"
                min={0}
                max={100}
                value={x}
                disabled={busy}
                onChange={(event) => setX(Number(event.target.value))}
              />
            </label>
            <label className="crop-control">
              Vertical position
              <input
                type="range"
                aria-label="Vertical position"
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
                Cancel photo
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
            Remove custom photo
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
            setError(message(error));
            setBusy(false);
          });
        }}
      >
        Sign out
      </button>
    </dialog>
  );
}
