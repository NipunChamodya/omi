import { useEffect, useState } from 'react';
import { useDataSaver } from './preferences';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaControls() {
  const saver = useDataSaver();
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [update, setUpdate] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('data-saver', saver.enabled);
  }, [saver.enabled]);
  useEffect(() => {
    const online = () => setOffline(false);
    const disconnected = () => setOffline(true);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const installed = () => setInstall(null);
    window.addEventListener('online', online);
    window.addEventListener('offline', disconnected);
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installed);
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    const changed = () => {
      const worker = registration?.installing;
      worker?.addEventListener('statechange', () => {
        if (
          active &&
          worker.state === 'installed' &&
          registration?.waiting &&
          navigator.serviceWorker.controller
        )
          setUpdate(true);
      });
    };
    if (
      import.meta.env.PROD &&
      'serviceWorker' in navigator &&
      window.isSecureContext
    ) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((value) => {
          if (!active) return;
          registration = value;
          setUpdate(Boolean(value.waiting));
          value.addEventListener('updatefound', changed);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }
    return () => {
      active = false;
      registration?.removeEventListener('updatefound', changed);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('beforeinstallprompt', prompt);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  return (
    <aside className="pwa-controls" aria-label="App settings">
      <label>
        <input
          type="checkbox"
          checked={saver.enabled}
          onChange={(event) => saver.set(event.target.checked)}
        />{' '}
        Data Saver Mode
      </label>
      <details>
        <summary>Install &amp; data settings</summary>
        <p>
          {saver.enabled
            ? 'Data Saver: avatars and decorative motion are off. Music and effects stay off until you choose to enable them.'
            : 'Standard Mode: normal visuals. Music and effects still require your permission.'}{' '}
          Gameplay checks and voice controls stay active.
        </p>
        {install ? (
          <button
            onClick={() => {
              void install
                .prompt()
                .then(() => install.userChoice)
                .then(() => setInstall(null))
                .catch(() => setInstall(null));
            }}
          >
            Install OMI
          </button>
        ) : (
          <p>
            To install, use your browser’s install menu. On iPhone or iPad, open
            in Safari, tap Share, then Add to Home Screen. Installation options
            vary by browser; HTTPS is required outside localhost.
          </p>
        )}
        {failed && (
          <p role="status">
            Offline setup is unavailable. OMI can still be used online.
          </p>
        )}
      </details>
      {offline && (
        <p role="status">
          You’re offline. Reconnect to continue; game actions require the
          server.
        </p>
      )}
      {update && (
        <p role="status">
          An OMI update is ready. After your game, close all OMI tabs and app
          windows, then reopen.
        </p>
      )}
    </aside>
  );
}
