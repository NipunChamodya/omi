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
const sponsor = readSponsor();

export function SponsorPlacement() {
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
