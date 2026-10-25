import { expect, test, vi } from 'vitest';
import * as layout from './layout';
import * as casts from './casts';
import { drawSpill } from './spillBake';

test('one spill draw prepares its independent source geometry once across all four tier and deck checks', () => {
  const layouts = vi.spyOn(layout, 'nineLayoutSource'), fixed = vi.spyOn(casts, 'bakeFixedKits');
  try {
    const rows = drawSpill({ phone: { placed: [], lights: [] }, desktop: { placed: [], lights: [] } });
    expect(rows.has('entries-open')).toBe(true); expect(rows.has('entries-capped')).toBe(true);
    expect(layouts).toHaveBeenCalledTimes(1); expect(fixed).toHaveBeenCalledTimes(1);
  } finally { layouts.mockRestore(); fixed.mockRestore(); }
});
