export const DEFAULT_TIMEZONE = 'Asia/Manila';

export function formatDateTime(d: Date | string | null | undefined, tz = DEFAULT_TIMEZONE) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDate(d: Date | string | null | undefined, tz = DEFAULT_TIMEZONE) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    dateStyle: 'medium',
  }).format(date);
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function toLocalInputValue(d: Date | null | undefined, tz = DEFAULT_TIMEZONE) {
  if (!d) return '';
  // Convert to "YYYY-MM-DDTHH:mm" in the given timezone for datetime-local inputs.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;
}

/** Parse a datetime-local input value as being in `tz` and return a UTC Date. */
export function fromLocalInputValue(value: string, tz = DEFAULT_TIMEZONE): Date | null {
  if (!value) return null;
  // Interpret wall-clock time in tz by computing the offset at that instant.
  const guess = new Date(`${value}:00Z`);
  if (isNaN(guess.getTime())) return null;
  const offset = tzOffsetMs(tz, guess);
  return new Date(guess.getTime() - offset);
}

function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUTC - date.getTime();
}
