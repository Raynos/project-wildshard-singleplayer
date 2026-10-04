import { describe, expect, it } from 'vitest';
import { App, Scope } from '@wildshard/engine';
import { Bullwhip, CRACK } from '../../../src/shards/sunscar-dunes/weapons/Bullwhip';

describe('bullwhip light and heavy input', () => {
  it('cracks on Attack, double-cracks on Heavy and on a released touch hold', () => {
    const app = new App(), scope = new Scope('sunscar-input'), whip = new Bullwhip(app);
    const swings: boolean[] = []; whip.onSwing = (heavy) => { swings.push(heavy); }; whip.install({ scope });
    try {
      app.input.press('attack'); expect(swings).toEqual([false]);
      whip.update(CRACK.cooldown); app.input.press('heavy'); expect(swings).toEqual([false, true]);
      whip.update(CRACK.heavyCooldown);
      whip.adsHeld = true; whip.update(0.3); expect(whip.charge).toBeCloseTo(0.5);
      whip.adsHeld = false; whip.update(0.01); expect(swings).toEqual([false, true, true]); expect(whip.charge).toBe(0);
    } finally { scope.dispose(); app.engineScope.dispose(); }
  });
  it('drops a charge on holster', () => {
    const app = new App(), scope = new Scope('sunscar-input-holster'), whip = new Bullwhip(app);
    const swings: boolean[] = []; whip.onSwing = (heavy) => { swings.push(heavy); }; whip.install({ scope });
    try {
      whip.adsHeld = true; whip.update(0.6); whip.holster = 0.2; whip.update(0.01);
      whip.adsHeld = false; whip.holster = 0; whip.update(0.01); expect(swings).toEqual([]);
    } finally { scope.dispose(); app.engineScope.dispose(); }
  });
});
