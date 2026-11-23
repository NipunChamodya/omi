/** First-party text placement. Creative is supplied by the application build, not a third-party script. */
function readSponsor() {
  const label: string | undefined = import.meta.env.VITE_OMI_SPONSOR_LABEL;
  const destination: string | undefined = import.meta.env.VITE_OMI_SPONSOR_URL;
  if (!label?.trim() || label.length > 80 || !destination) return null;
  try {
    const url = new URL(destination);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return { label: label.trim(), url: url.href };
  } catch {
    return null;
  }
}
const openingKey = 'omi.opening-sponsor-seen';

export function claimOpeningSponsor(): boolean {
  if (!readSponsor()) return false;
  try {
    if (sessionStorage.getItem(openingKey)) return false;
    sessionStorage.setItem(openingKey, '1');
    return true;
  } catch {
    return false;
  }
}

export function SponsorPlacement() {
  const sponsor = readSponsor();
  if (!sponsor) return null;
  return (
    <aside className="quiet-note" aria-label="Advertisement">
      <span>Advertisement · </span>
      <a href={sponsor.url} target="_blank" rel="sponsored noopener noreferrer">
        {sponsor.label}
      </a>
    </aside>
  );
}
