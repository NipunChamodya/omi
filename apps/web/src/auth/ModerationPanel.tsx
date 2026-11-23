import { useCopy } from '../i18n/locale';
import { useState } from 'react';
import type { ModerationReport } from '@omi/shared';
import { authApi } from './api';

export function ModerationPanel({ csrf }: { csrf: string }) {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const text = useCopy();
  async function load(action: Parameters<typeof authApi.moderation>[0]) {
    setBusy(true);
    try {
      const next = await authApi.moderation(action, csrf);
      setReports(next.reports);
      setStatus(
        next.reports.length === 0
          ? text('No recent reports.')
          : text('Reports updated.'),
      );
    } catch {
      setStatus(text('Could not update reports. Refresh and try again.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>{text('Moderation')}</summary>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => void load({ action: 'list' })}
      >
        {text('Load recent reports')}
      </button>
      <p role="status">{status}</p>
      <ul>
        {reports.map((report) => (
          <li key={report.id}>
            <p>
              {report.archived
                ? text('Active restriction')
                : `${report.reason} · ${report.status}`}{' '}
              · {new Date(report.createdAt).toLocaleDateString()}
            </p>
            {report.evidence && <blockquote>{report.evidence}</blockquote>}
            {report.note && <p>{report.note}</p>}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() =>
                void load({
                  action: 'restrict',
                  id: report.id,
                  restricted: !report.communicationRestricted,
                })
              }
            >
              {text(
                report.communicationRestricted
                  ? 'Restore communication'
                  : 'Restrict communication',
              )}
            </button>
            {!report.archived &&
              (['reviewed', 'dismissed', 'open'] as const)
                .filter((next) => next !== report.status)
                .map((next) => (
                  <button
                    key={next}
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void load({
                        action: 'review',
                        id: report.id,
                        revision: report.revision,
                        status: next,
                      })
                    }
                  >
                    {next === 'open'
                      ? text('Reopen report')
                      : next === 'reviewed'
                        ? text('Mark reviewed')
                        : text('Dismiss report')}
                  </button>
                ))}
          </li>
        ))}
      </ul>
    </details>
  );
}
