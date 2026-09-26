import { describe, expect, it } from 'vitest';
import { formatLastUpdated, lastUpdatedLabel } from './time';

describe('formatLastUpdated', () => {
  const now = new Date(2026, 8, 26, 18, 9).getTime();

  it('shows the time for an update from today', () => {
    expect(formatLastUpdated(new Date(2026, 8, 26, 9, 5).getTime(), now)).toBe('Updated 9:05 AM');
  });

  it('keeps the clock time for an update from yesterday', () => {
    expect(formatLastUpdated(new Date(2026, 8, 25, 21, 40).getTime(), now)).toBe('Updated yesterday, 9:40 PM');
  });

  it('shows the month, day, and time for an earlier date this year', () => {
    expect(formatLastUpdated(new Date(2026, 0, 15, 9, 5).getTime(), now)).toBe('Updated Jan 15, 9:05 AM');
  });

  it('includes the year and time when the last update was in another year', () => {
    expect(formatLastUpdated(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe('Updated Dec 31, 2025, 11:59 PM');
  });
});

describe('lastUpdatedLabel', () => {
  it('includes a full date and time for assistive text', () => {
    expect(lastUpdatedLabel(new Date(2026, 8, 26, 18, 9).getTime())).toMatch(/^Last updated September 26, 2026.*6:09 PM$/);
  });
});
