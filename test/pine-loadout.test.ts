import { describe, expect, it } from 'vitest';
import { BOLT_LABEL, BROADHEAD_DEER, POUCH_MAX, Quiver, boltDamage, boltFlight } from '../src/pinehollow/ammo';
import { TRADES } from '../src/pinehollow/quest/trades';
import { ITEMS } from '../src/game/Inventory';
import { TUBE_MAX, cycleAction, feedRound, leverOpen } from '../src/player/LeverRifle';
import { BowDraw, DRAW_TIME } from '../src/player/bowDraw';

// PINE-HOLLOW-REMASTER PH-C11: the loadout's pure rules — special bolts, the lever gun's tube, the trader's ammo swaps
describe('special bolts (ammo.ts)', () => {
  it('pitch-tipped bolts fly flatter and the rain does nothing to them', () => {
    const dry = boltFlight('pitch', 0), wet = boltFlight('pitch', 1);
    expect(dry.gravity).toBeLessThan(1);
    expect(dry.drag).toBeLessThan(1);
    expect(wet).toEqual(dry);
  });
  it('iron and broadhead bolts soak in the rain: more drop, more drag', () => {
    for (const k of ['iron', 'broadhead'] as const) {
      const dry = boltFlight(k, 0), wet = boltFlight(k, 1);
      expect(wet.gravity).toBeGreaterThan(dry.gravity);
      expect(wet.drag).toBeGreaterThan(dry.drag);
    }
    expect(boltFlight('iron', 0)).toEqual({ gravity: 1, drag: 1 }); // dry iron = the crossbow exactly as before
    expect(boltFlight('iron', 3)).toEqual(boltFlight('iron', 1));   // clamped
  });
  it('a broadhead cuts deeper in deer-sized game only', () => {
    expect(boltDamage('broadhead', 'deer')).toBe(BROADHEAD_DEER);
    expect(boltDamage('broadhead', 'boar')).toBe(BROADHEAD_DEER);
    expect(boltDamage('broadhead', 'bear')).toBe(1);
    expect(boltDamage('broadhead', 'antler-king')).toBe(1);
    expect(boltDamage('pitch', 'deer')).toBe(1);
    expect(boltDamage('iron', 'deer')).toBe(1);
  });
  it('the quiver swaps the loaded stack in and out of the crossbow', () => {
    const q = new Quiver({ pitch: 4 });
    expect(q.selected).toBe('iron');
    expect(q.next()).toBe('pitch');                 // broadhead is empty: skipped
    expect(q.select('broadhead', 30)).toBeNull();   // nothing to load
    expect(q.select('pitch', 27)).toBe(4);          // iron's 27 stashed, pitch's 4 go to the crossbow
    expect(q.counts.iron).toBe(27);
    expect(q.count('pitch', 3)).toBe(3);            // the loaded kind's count is the live one
    q.add('iron', 10);                               // a non-loaded stack fills up here
    expect(q.counts.iron).toBe(POUCH_MAX);          // capped
    expect(q.next()).toBe('iron');
    expect(q.cycle(0)).toBe(POUCH_MAX);             // pitch ran out: back to iron
    expect(q.selected).toBe('iron');
    expect(q.counts.pitch).toBe(0);
  });
  it('every bolt kind has a HUD label', () => {
    expect(Object.keys(BOLT_LABEL).sort()).toEqual(['broadhead', 'iron', 'pitch']);
  });
});

describe('the lever-action (LeverRifle.ts)', () => {
  it('the lever is shut at rest and fully thrown mid-cycle', () => {
    expect(leverOpen(0)).toBe(0);
    expect(leverOpen(1)).toBe(0);
    expect(leverOpen(0.46)).toBe(1);
    expect(leverOpen(0.2)).toBeGreaterThan(0);
    expect(leverOpen(0.8)).toBeLessThan(1);
  });
  it('a cycle chambers from the tube; an empty tube leaves the chamber empty', () => {
    expect(cycleAction({ tube: 3, chambered: false, reserve: 9 })).toEqual({ tube: 2, chambered: true, reserve: 9 });
    expect(cycleAction({ tube: 0, chambered: false, reserve: 9 })).toEqual({ tube: 0, chambered: false, reserve: 9 });
    expect(cycleAction({ tube: 3, chambered: true, reserve: 9 })).toEqual({ tube: 3, chambered: true, reserve: 9 });
  });
  it('the gate takes one round at a time, up to a full tube, from the reserve', () => {
    let a = { tube: TUBE_MAX - 2, chambered: true, reserve: 1 };
    a = feedRound(a);
    expect(a).toEqual({ tube: TUBE_MAX - 1, chambered: true, reserve: 0 });
    expect(feedRound(a)).toEqual(a); // no reserve
    expect(feedRound({ tube: TUBE_MAX, chambered: false, reserve: 5 }).tube).toBe(TUBE_MAX); // full
  });
});

describe('the longbow draw (bowDraw.ts, Nalati verbatim)', () => {
  it('a release before full draw lets down; a release at full looses', () => {
    const d = new BowDraw();
    expect(d.step(0.1, true, false)).toBe('start');
    expect(d.step(0.1, false, false)).toBe('letdown');
    const e = new BowDraw();
    let ev = e.step(0.01, true, false);
    for (let t = 0; t < DRAW_TIME + 0.1; t += 0.05) ev = e.step(0.05, true, false) ?? ev;
    expect(e.full).toBe(true);
    expect(e.step(0.016, false, false)).toBe('loose');
  });
});

describe("the trader's ammunition (trades.ts)", () => {
  it('sells pitch-tipped and broadhead bolts, cartridges and arrows for items that exist', () => {
    const ammo = TRADES.flatMap((t) => ('ammo' in t.get ? [t.get.ammo] : []));
    expect(ammo.sort()).toEqual(['arrow', 'broadhead', 'cartridge', 'pitch']);
    for (const t of TRADES) for (const g of t.give) expect(g.item in ITEMS, g.item).toBe(true);
  });
});
