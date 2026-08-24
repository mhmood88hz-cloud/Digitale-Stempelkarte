export interface MonthRange {
  start: Date;
  end: Date; // exclusive
}

/** Parses a "YYYY-MM" string into a [start, end) date range covering that calendar month (UTC). */
export function parseMonth(month: string): MonthRange {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Invalid month "${month}", expected format YYYY-MM`);

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`Invalid month "${month}", month must be 01-12`);

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end };
}

/** The calendar month (UTC) that `now` falls into -- defaults to the current month if omitted. */
export function currentMonth(now: Date = new Date()): MonthRange {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
