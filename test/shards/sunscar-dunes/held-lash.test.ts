import { expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { Scope } from '../../../src/engine/app/scope';
import { Bullwhip, CRACK } from '../../../src/shards/sunscar-dunes/weapons/Bullwhip';
import { SignalLashInput } from '../../../src/shards/sunscar-dunes/runtime/lashInput';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';

const hold = (targetId = 'creature'): HeadlessCommand => ({ kind: 'player', moveX: 0, moveZ: 0, yaw: 0, heavy: { targetId } });
const release: HeadlessCommand = { kind: 'player', moveX: 0, moveZ: 0, yaw: 0 };

it('matches the shipping Bullwhip charge and short/long release law, including a quietly restored hold', () => {
  const app = new App(), scope = new Scope('signal-hold-oracle'), whip = new Bullwhip(app), input = new SignalLashInput();
  let swings = 0; whip.onSwing = heavy => { expect(heavy).toBe(true); swings++; }; whip.install({ scope });
  try {
    for (const duration of [0.01, 0.1, 0.3, 0.6, 1.7]) {
      const before = swings;
      whip.adsHeld = true; whip.update(duration);
      expect(input.sample(duration, [hold()], true)).toEqual({ released: false, target: 'creature' });
      expect(input.charge(CRACK.charge)).toBe(whip.charge);
      const restored = new SignalLashInput(); restored.restore(input.snapshot());
      expect(restored.charge(CRACK.charge)).toBe(whip.charge); expect(swings).toBe(before);
      whip.adsHeld = false; whip.update(1 / 60);
      expect(input.sample(1 / 60, [release], true)).toEqual({ released: true, target: 'creature' });
      expect(restored.sample(1 / 60, [release], true)).toEqual({ released: true, target: 'creature' });
      expect(input.charge(CRACK.charge)).toBe(whip.charge); expect(swings).toBe(before + 1);
      expect(input.sample(1 / 60, [], true).released).toBe(false);
    }
  } finally { scope.dispose(); app.engineScope.dispose(); }
});

it('matches the shipping holster cancellation and retains only the actual last held aim', () => {
  const app = new App(), scope = new Scope('signal-hold-cancel'), whip = new Bullwhip(app), input = new SignalLashInput();
  let swings = 0; whip.onSwing = () => { swings++; }; whip.install({ scope });
  try {
    whip.adsHeld = true; whip.update(0.3); input.sample(0.3, [hold('first')], true);
    input.sample(1 / 60, [hold('second')], true);
    whip.holster = 0.2; whip.update(1 / 60);
    expect(input.sample(1 / 60, [hold('second')], false).released).toBe(false);
    whip.adsHeld = false; whip.holster = 0; whip.update(1 / 60);
    expect(input.sample(1 / 60, [release], true).released).toBe(false); expect(swings).toBe(0);
    input.sample(1 / 60, [hold('first'), hold('second')], true);
    expect(input.sample(1 / 60, [release], true)).toEqual({ released: true, target: 'second' });
    expect(() => input.restore('{"version":1,"held":1,"wasHeld":false,"target":null}')).toThrow('inactive');
  } finally { scope.dispose(); app.engineScope.dispose(); }
});
