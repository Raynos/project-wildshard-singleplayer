import { describe, expect, it } from 'vitest';
import { App, Scope } from '#engine';
import { TemplateWhip } from '#shards/_template/weapons/TemplateWhip';

describe('template whip light and heavy input', () => {
  it('binds desktop heavy and releases the touch adsHeld charge exactly once', () => {
    const app = new App(), scope = new Scope('template-input'), whip = new TemplateWhip(app);
    const swings: boolean[] = []; whip.onSwing = (heavy) => { swings.push(heavy); }; whip.install({ scope });
    try {
      app.input.press('attack'); expect(swings).toEqual([false]);
      whip.update(0.4); app.input.press('heavy'); expect(swings).toEqual([false, true]);
      whip.update(0.8); app.input.press('attack');
      whip.adsHeld = true; whip.update(0.3); expect(whip.charge).toBeCloseTo(0.5);
      whip.update(0.3); expect(whip.charge).toBe(1); expect(swings).toEqual([false, true, false]);
      whip.adsHeld = false; whip.update(0.01); whip.update(0.01);
      expect(swings).toEqual([false, true, false, true]); expect(whip.charge).toBe(0);
      whip.update(0.8); whip.altHeld = true; app.input.press('attack'); expect(swings.at(-1)).toBe(false);
    } finally { scope.dispose(); app.engineScope.dispose(); }
  });

  it('cancels a charge on holster or scope disposal', () => {
    const app = new App(), scope = new Scope('template-input-cancel'), whip = new TemplateWhip(app);
    const swings: boolean[] = []; whip.onSwing = (heavy) => { swings.push(heavy); }; whip.install({ scope });
    try {
      whip.adsHeld = true; whip.update(0.6); whip.holster = 0.2; whip.update(0.01);
      whip.adsHeld = false; whip.holster = 0; whip.update(0.01); expect(swings).toEqual([]);
      whip.adsHeld = true; whip.update(0.6); scope.dispose(); whip.adsHeld = false; whip.update(0.01);
      expect(swings).toEqual([]); expect(whip.charge).toBe(0);
    } finally { scope.dispose(); app.engineScope.dispose(); }
  });
});
