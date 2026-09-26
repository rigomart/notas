function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function formatLastUpdated(updatedAt: number, now = Date.now()): string {
  const date = new Date(updatedAt);
  const current = new Date(now);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (sameDay(date, current)) return `Updated ${time}`;

  const yesterday = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Updated yesterday';

  return `Updated ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === current.getFullYear() ? {} : { year: 'numeric' }),
  })}`;
}

export function lastUpdatedLabel(updatedAt: number): string {
  return `Last updated ${new Date(updatedAt).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}
