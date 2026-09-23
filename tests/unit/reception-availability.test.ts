import { describe, expect, it } from 'vitest';
import { AVAILABILITY_COPY, receptionAvailabilityView } from '@/lib/receptionAvailability';

describe('receptionAvailabilityView', () => {
  it('does not treat an RPC error as an empty inventory', () => {
    expect(receptionAvailabilityView(false, new Error('permission denied'), 0)).toBe('error');
    expect(AVAILABILITY_COPY.error).not.toMatch(/permission denied|no hay habitaciones/i);
  });

  it('shows empty only when the query succeeded with zero rooms', () => {
    expect(receptionAvailabilityView(false, null, 0)).toBe('empty');
    expect(receptionAvailabilityView(false, null, 3)).toBe('rooms');
    expect(receptionAvailabilityView(true, null, 0)).toBe('loading');
  });
});
