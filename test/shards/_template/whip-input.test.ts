import { describe, expect, it } from 'vitest';
import { declaredTemplateItems } from '../../fake/declaredTemplateItems';

describe('declared template whip light and heavy input', () => {
  it('binds desktop heavy and releases a fixed-step touch charge exactly once', () => {
    const f = declaredTemplateItems();
    try {
      f.app.input.press('attack'); expect(f.swings).toEqual([]); f.step(); expect(f.swings).toHaveLength(1);
      f.step(24); f.app.input.press('heavy'); f.step(); expect(f.swings).toHaveLength(2);
      f.step(48); f.app.input.press('attack'); f.step(); expect(f.swings).toHaveLength(3);
      f.service.adsHeld = true; f.step(18); expect(f.runtime.snapshot().chargeTime).toBeCloseTo(0.3);
      f.step(19); expect(f.swings).toHaveLength(3);
      f.service.adsHeld = false; f.step(2); expect(f.swings).toHaveLength(4);
      expect(f.runtime.snapshot().chargeTime).toBe(0);
      f.step(48); f.weapon.altHeld = true; f.app.input.press('attack'); f.step(); expect(f.swings).toHaveLength(5);
      expect(f.runtime.remainingCooldown).toBeCloseTo(0.4);
    } finally { f.dispose(); f.app.engineScope.dispose(); }
  });
  it('cancels a charge when equipment is disabled or the item scope is disposed', () => {
    const f = declaredTemplateItems();
    try {
      f.service.adsHeld = true; f.step(40); f.service.enabled = false; f.step();
      f.service.adsHeld = false; f.service.enabled = true; f.step(); expect(f.swings).toEqual([]);
      expect(f.runtime.snapshot().held).toBe(false);
      f.service.adsHeld = true; f.step(40); f.dispose();
      const before = f.runtime.snapshot(); f.service.adsHeld = false; f.step();
      expect(f.swings).toEqual([]); expect(f.runtime.snapshot().tick).toBe(before.tick);
    } finally { f.dispose(); f.app.engineScope.dispose(); }
  });
});
