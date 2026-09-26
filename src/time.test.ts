import { describe, expect, it } from 'vitest';
import { formatLastUpdated, lastUpdatedLabel } from './time';

describe('formatLastUpdated', () => {
  const now = new Date(2026, 8, 26, 18, 9).getTime();

  it('shows the time for an update from today', () => {
    expect(formatLastUpdated(new Date(2026, 8, 26, 9, 5).getTime(), now)).toBe('Updated 9:05 AM');
  });

  it('names yesterday without repeating the clock time', () => {
    expect(formatLastUpdated(new Date(2026, 8, 25, 21, 40).getTime(), now)).toBe('Updated yesterday');
  });

  it('shows the month and day for an earlier date this year', () => {
    expect(formatLastUpdated(new Date(2026, 0, 15, 9, 5).getTime(), now)).toBe('Updated Jan 15');
  });

  it('includes the year when the last update was in another year', () => {
    expect(formatLastUpdated(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe('Updated Dec 31, 2025');
  });
});

describe('lastUpdatedLabel', () => {
  it('includes a full date and time for assistive text', () => {
    expect(lastUpdatedLabel(new Date(2026, 8, 26, 18, 9).getTime())).toMatch(/^Last updated September 26, 2026.*6:09 PM$/);
  });
});
