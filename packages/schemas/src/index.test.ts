import { describe, expect, it } from 'vitest';
import { CreateBookingInput, OpenMatchInput } from './index';

describe('CreateBookingInput', () => {
  const courtId = '7f1c2a9e-1b6f-4b8e-9b44-2d7c5e0a1f33';

  it('accepts a slot whose end is after its start', () => {
    const r = CreateBookingInput.safeParse({
      courtId,
      startsAt: '2026-12-01T18:00:00+08:00',
      endsAt: '2026-12-01T19:00:00+08:00',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a slot that ends before it starts', () => {
    const r = CreateBookingInput.safeParse({
      courtId,
      startsAt: '2026-12-01T19:00:00+08:00',
      endsAt: '2026-12-01T18:00:00+08:00',
    });
    expect(r.success).toBe(false);
  });
});

describe('OpenMatchInput', () => {
  it('defaults allyIds to an empty list', () => {
    const r = OpenMatchInput.parse({
      bookingId: '7f1c2a9e-1b6f-4b8e-9b44-2d7c5e0a1f33',
      mode: 'ranked',
      teamSize: 2,
    });
    expect(r.allyIds).toEqual([]);
  });
});
