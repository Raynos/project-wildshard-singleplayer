import { expect, it } from 'vitest';
import { PineAmmunition } from '../../../src/shards/pine-hollow/runtime/weapons/ammunition';
import { Quiver, type AmmoKind, type BoltKind } from '../../../src/shards/pine-hollow/loadout/ammo';

function setup() {
  const crossbow = { state: { quiver: 30, loaded: true, reloading: false }, addBolts: (n: number): void => { crossbow.state.quiver = Math.min(30, crossbow.state.quiver + n); } };
  const lever = { act: { rounds: 7 }, store: { reserve: 21 } }, longbow = { state: { arrows: 20 } };
  return { crossbow, lever, longbow, ammo: new PineAmmunition({ crossbow, lever, longbow }) };
}

it('matches the page Quiver selection, live/parked grants, rail state and exhausted-stack fallback', () => {
  const native = setup(), page = setup(), q = new Quiver();
  const kinds: readonly BoltKind[] = ['iron', 'pitch', 'broadhead'];
  const select = (kind: BoltKind): void => {
    const n = q.select(kind, page.crossbow.state.quiver);
    if (n !== null) { page.crossbow.state.quiver = n; page.crossbow.state.loaded = n > 0 && page.crossbow.state.loaded; }
  };
  for (let i = 0; i < 1000; i++) {
    const kind = kinds[i % 3] ?? 'iron';
    native.ammo.add(kind, 4);
    if (kind === q.selected) page.crossbow.addBolts(4); else q.add(kind, 4);
    native.ammo.loadKind(kind); select(kind);
    for (const sample of [native, page]) {
      sample.crossbow.state.quiver = Math.max(0, sample.crossbow.state.quiver - (i % 31));
      sample.crossbow.state.loaded = i % 3 === 0; sample.crossbow.state.reloading = i % 5 === 0;
    }
    native.ammo.update(); q.stash(page.crossbow.state.quiver);
    if (q.selected !== 'iron' && page.crossbow.state.quiver <= 0 && !page.crossbow.state.loaded && !page.crossbow.state.reloading) select('iron');
    expect(native.ammo.selected).toBe(q.selected); expect(native.crossbow.state).toEqual(page.crossbow.state);
    for (const k of kinds) expect(native.ammo.count(k)).toBe(q.count(k, page.crossbow.state.quiver));
    native.ammo.restore(native.ammo.snapshot());
  }
});

it('counts chamber + tube + reserve, applies the real caps and grants to the actual weapons', () => {
  const { ammo, lever, longbow, crossbow } = setup();
  expect(ammo.count('cartridge')).toBe(28); expect(ammo.room('cartridge', 14)).toBe(true);
  ammo.add('cartridge', 14); expect(lever.store.reserve).toBe(35);
  expect(ammo.room('arrow', 1)).toBe(false); longbow.state.arrows = 10;
  expect(ammo.room('arrow', 10)).toBe(true); ammo.add('arrow', 11); expect(longbow.state.arrows).toBe(20);
  expect(ammo.room('iron', 1)).toBe(false); crossbow.state.quiver = 20;
  expect(ammo.room('iron', 10)).toBe(true); ammo.add('iron', 10); expect(crossbow.state.quiver).toBe(30);
  const kinds: readonly AmmoKind[] = ['iron', 'pitch', 'broadhead', 'arrow', 'cartridge'];
  for (const kind of kinds) expect(() => ammo.add(kind, -1)).toThrow();
});

it('refuses malformed or mismatched saved live stacks atomically and preserves a stowed selected stack', () => {
  const { ammo, crossbow } = setup(); expect(ammo.changed).toBe(false);
  ammo.add('pitch', 10); ammo.loadKind('pitch'); crossbow.state.quiver = 7;
  const saved = ammo.snapshot(); expect(saved).toEqual({ selected: 'pitch', iron: 30, pitch: 7, broadhead: 0 });
  for (const bad of [{ ...saved, selected: 'unknown' }, { ...saved, pitch: 8 }, { ...saved, iron: 31 }, { ...saved, broadhead: 0.5 }, { ...saved, extra: true }]) {
    expect(() => ammo.restore(bad)).toThrow(); expect(ammo.snapshot()).toEqual(saved);
  }
  ammo.restore(saved); expect(ammo.snapshot()).toEqual(saved);
  ammo.cycle(); expect(ammo.selected).toBe('iron'); expect(crossbow.state.quiver).toBe(30);
});
