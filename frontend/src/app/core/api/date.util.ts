/**
 * Formats a Date as a local wall-clock ISO-8601 string with no timezone
 * designator (e.g. "2026-09-02T22:41:21.074"), matching what the backend's
 * Java `LocalDateTime` fields expect. `Date.toISOString()` produces UTC and
 * stripping its trailing "Z" would silently shift the value by the local
 * offset when it's later parsed/displayed as local time - this avoids that.
 */
export function toLocalDateTimeString(date: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}`
  );
}
