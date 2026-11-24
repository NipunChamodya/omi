import { describe, expect, it } from 'vitest';
import { translate } from './locale';

describe('interface copy', () => {
  it('renders translated gameplay and account safety labels', () => {
    expect(translate('si', 'Game table')).toBe('ක්‍රීඩා මේසය');
    expect(translate('si', 'Protected play')).toBe('ආරක්ෂිත ක්‍රීඩාව');
    expect(translate('en', 'Game table')).toBe('Game table');
  });

  it('preserves unknown text and does not read inherited object properties', () => {
    expect(translate('si', 'Unknown message')).toBe('Unknown message');
    expect(translate('si', 'constructor')).toBe('constructor');
  });
});

it('uses a friendly Sinhala fallback for unknown table codes', async () => {
  const { tableErrorCopy } = await import('./tableErrors');
  const fallback = tableErrorCopy({ code: 'UNKNOWN' });
  expect(tableErrorCopy({ code: 'constructor' })).toBe(fallback);
  expect(tableErrorCopy({ code: 'ROOM_CAPACITY' })).toBe(
    tableErrorCopy({ code: 'RATE_LIMITED' }),
  );
  expect(tableErrorCopy({ code: 'ROOM_CAPACITY' })).not.toBe(fallback);
  expect(
    tableErrorCopy({ code: 'REPORT_REJECTED', action: 'report-no-trump' }),
  ).not.toBe(tableErrorCopy({ code: 'REPORT_REJECTED' }));
});
