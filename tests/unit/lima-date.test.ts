import { describe, it, expect } from 'vitest';
import { addDaysYmd, horaLima, hoyLima } from '@/lib/limaDate';

describe('limaDate', () => {
  it('hoyLima returns ISO calendar date', () => {
    expect(hoyLima()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('horaLima uses America/Lima, not the browser clock', () => {
    expect(horaLima(new Date('2026-09-24T00:30:00Z'))).toBe(19);
    expect(horaLima(new Date('2026-09-24T05:00:00Z'))).toBe(0);
  });

  it('addDaysYmd rolls month boundaries', () => {
    expect(addDaysYmd('2026-09-21', 1)).toBe('2026-09-22');
    expect(addDaysYmd('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
  });
});
