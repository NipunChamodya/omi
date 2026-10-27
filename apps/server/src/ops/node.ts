// Baseline reviewed against the official 2026-10-21 Node 22 security release.
export const NODE_SECURITY_BASELINE = '22.23.4';
export function supportedNode22(version: string): boolean {
  const match = /^22\.(\d+)\.(\d+)$/.exec(version);
  return Boolean(
    match &&
    (Number(match[1]) > 23 ||
      (Number(match[1]) === 23 && Number(match[2]) >= 4)),
  );
}
