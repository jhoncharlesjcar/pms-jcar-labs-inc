/** Fecha operativa del PMS: día civil en America/Lima (no TZ del navegador). */

export const LIMA_TZ = 'America/Lima';

export function hoyLima(date: Date = new Date()): string {
  return date.toLocaleDateString('sv-SE', { timeZone: LIMA_TZ });
}

export function addDaysYmd(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
