import { readFileSync } from 'node:fs';

// The reviewed repository baseline is also used before the first service starts.
const minimum = readFileSync(
  new URL('../../.nvmrc', import.meta.url),
  'utf8',
).trim();
export function requireDeploymentNode(version) {
  const parts = /^22\.(\d+)\.(\d+)$/.exec(version);
  const [, minor, patch] = minimum.split('.').map(Number);
  if (
    !parts ||
    Number(parts[1]) < minor ||
    (Number(parts[1]) === minor && Number(parts[2]) < patch)
  ) {
    throw new Error(
      `Production requires Node ${minimum} or newer within Node 22. Select a patched runtime with OMI_NODE_BINARY=/absolute/path/to/node; no services were started.`,
    );
  }
}

// Do not persist arbitrary application/provider output: even redaction by key can
// miss opaque tokens, user data and multi-line OAuth responses. Keep only known
// operational classifications, with a bounded window for split stream chunks.
const hints = [
  [
    /Production requires Node/,
    'Backend rejected the Node runtime; select the repository-required patched Node 22 runtime.',
  ],
  [
    /EADDRINUSE/,
    'A required port is occupied; inspect listeners without terminating unrelated processes.',
  ],
  [
    /EACCES|EPERM/,
    'Permission denied; inspect private runtime/database directory permissions.',
  ],
  [
    /SQLITE_CANTOPEN|unable to open database/,
    'SQLite cannot open the configured database; inspect DATABASE_PATH and parent permissions.',
  ],
  [
    /SQLITE_CORRUPT|database disk image is malformed/,
    'SQLite integrity failure; stop and inspect a safe backup, never delete the database.',
  ],
  [
    /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/,
    'A runtime module is missing; inspect the production build and installed dependencies.',
  ],
  [
    /Production APP_ORIGIN must use HTTPS/,
    'APP_ORIGIN must be an exact HTTPS origin.',
  ],
  [
    /Production OAuth callback requires HTTPS/,
    'GOOGLE_CALLBACK_URL must use HTTPS.',
  ],
  [
    /Configure all three Google settings together/,
    'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL must all be configured.',
  ],
  [
    /listen_failed/,
    'Backend could not bind its listener; check its loopback port and permissions.',
  ],
];
export function serviceDiagnostic() {
  let window = '';
  const found = new Set();
  return {
    append(chunk) {
      // Bound before concatenating, including a single unusually large chunk.
      window = (
        window +
        chunk.subarray(Math.max(0, chunk.length - 8192)).toString('utf8')
      ).slice(-8192);
      for (const [pattern, hint] of hints)
        if (pattern.test(window)) found.add(hint);
    },
    summary() {
      return (
        [...found].join('\n') ||
        'No recognized safe diagnostic. Inspect runtime, configuration, dependencies and permissions locally; raw service output is intentionally not retained.'
      );
    },
  };
}

// Notify once for spawn failure or closed pipes; raw output never leaves this
// observer. The supervisor decides whether an exit was expected during shutdown.
export function watchService(child, notify) {
  const diagnostic = serviceDiagnostic();
  let notified = false;
  child.stdout?.on('data', (chunk) => diagnostic.append(chunk));
  child.stderr?.on('data', (chunk) => diagnostic.append(chunk));
  const finish = (code, signal, spawnCode) => {
    if (notified) return;
    notified = true;
    notify({ code, signal, spawnCode, summary: diagnostic.summary() });
  };
  child.once('error', (error) => finish(null, null, error.code ?? 'UNKNOWN'));
  // close follows final pipe output, unlike exit.
  child.once('close', (code, signal) => finish(code, signal));
}
