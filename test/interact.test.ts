// src/world/interact/* — the interactables kit's data side: the flag store, conditions, and the table validator run
// against Driftwood Isle's own table (the shape a chunk upload would be checked against).
import { describe, expect, it } from 'vitest';
import { Flags, test as holds } from '../src/world/interact/flags';
import { validateTable } from '../src/world/interact/validate';
import { flagsRaised, flagsRead, type InteractTable } from '../src/world/interact/types';
import { DRIFTWOOD_INTERACT, SEA_GLASS_COUNT, SHARD_FLAGS } from '../src/world/interact/driftwood';
import { ITEMS } from '../src/game/Inventory';

const items = Object.keys(ITEMS);

describe('Flags', () => {
  it('sets, clears, toggles, counts by prefix and tells listeners', () => {
    const f = new Flags('chunk://test/a');
    const seen: string[] = [];
    f.onChange((flag, on) => { seen.push(`${on ? "+" : "-"}${flag}`); });
    f.set('glass:1'); f.set('glass:2'); f.set('glass:2');
    expect(f.count('glass:')).toBe(2);
    expect(f.toggle('lever:a')).toBe(true);
    expect(f.toggle('lever:a')).toBe(false);
    f.clear('glass:1');
    expect(seen).toEqual(['+glass:1', '+glass:2', '+lever:a', '-lever:a', '-glass:1']);
  });

  it('persists per shard, but never the transient plate flags', () => {
    const a = new Flags('chunk://test/a');
    a.set('open:chest'); a.set('plate:p1');
    new Flags('chunk://test/b').set('open:other');
    const again = new Flags('chunk://test/a');
    expect(again.has('open:chest')).toBe(true);
    expect(again.has('plate:p1')).toBe(false);
    expect(again.has('open:other')).toBe(false);
    again.reset();
    expect(new Flags('chunk://test/a').all).toEqual([]);
  });

  it('survives a storage that throws (iOS private mode)', () => {
    const f = new Flags('chunk://test/c', false);
    f.set('x:y');
    expect(f.has('x:y')).toBe(true);
  });
});

describe('conditions', () => {
  const f = { has: (s: string) => ['a', 'b'].includes(s) };
  it('all / any / none, and an absent condition holds', () => {
    expect(holds(f, undefined)).toBe(true);
    expect(holds(f, { all: ['a', 'b'] })).toBe(true);
    expect(holds(f, { all: ['a', 'c'] })).toBe(false);
    expect(holds(f, { any: ['c', 'b'] })).toBe(true);
    expect(holds(f, { any: ['c'] })).toBe(false);
    expect(holds(f, { all: ['a'], none: ['b'] })).toBe(false);
  });
});

describe('Driftwood interactables table', () => {
  it('passes the validator', () => {
    expect(validateTable(DRIFTWOOD_INTERACT, { items })).toEqual([]);
  });

  it('has the kit: chests (locked + treasure), a key, doors, levers, plates, a barrel, pickups, a beacon, a bench, an altar', () => {
    const kinds = new Set(DRIFTWOOD_INTERACT.rows.map((r) => r.kind));
    for (const k of ['chest', 'key', 'door', 'lever', 'plate', 'barrel', 'pickup', 'beacon', 'bench', 'altar']) expect(kinds, k).toContain(k);
  });

  it('12–15 sea-glass pieces, each raising its own glass flag', () => {
    expect(SEA_GLASS_COUNT).toBeGreaterThanOrEqual(12);
    expect(SEA_GLASS_COUNT).toBeLessThanOrEqual(15);
    const glass = DRIFTWOOD_INTERACT.rows.filter((r) => r.kind === 'pickup' && r.look === 'seaglass');
    expect(glass.length).toBe(SEA_GLASS_COUNT);
    expect(new Set(glass.flatMap((g) => g.sets ?? [])).size).toBe(SEA_GLASS_COUNT);
  });

  it('every glyph shard is raised by exactly one row, and the altar reads all three', () => {
    for (const s of SHARD_FLAGS) expect(DRIFTWOOD_INTERACT.rows.filter((r) => flagsRaised(r).includes(s)).length, s).toBe(1);
    const altar = DRIFTWOOD_INTERACT.rows.find((r) => r.kind === 'altar');
    for (const s of SHARD_FLAGS) expect(altar ? flagsRead(altar) : [], s).toContain(s);
  });
});

describe('validateTable catches a broken table', () => {
  const base: InteractTable = { external: [], rows: [] };
  it('duplicate ids, a lock with no key, an unraised flag, a bad item, a point outside the chunk', () => {
    const errs = validateTable({
      ...base,
      rows: [
        { kind: 'chest', id: 'c', at: { poi: 'world', x: 0, z: 0 }, lock: 'gold', loot: [{ item: 'unobtainium' }] },
        { kind: 'lever', id: 'c', at: { poi: 'world', x: 999, z: 0 } },
        { kind: 'door', id: 'd', look: 'sluice', w: 2, h: 2, at: { poi: 'world', x: 0, z: 0 }, opensWhen: { all: ['plate:nowhere'] } },
      ],
    }, { items });
    const all = errs.join('\n');
    expect(all).toMatch(/duplicate id/);
    expect(all).toMatch(/key:gold/);
    expect(all).toMatch(/plate:nowhere/);
    expect(all).toMatch(/unknown item 'unobtainium'/);
    expect(all).toMatch(/outside the chunk/);
  });

  it('a door that can never open, a plate too big, a POI offset too far', () => {
    const errs = validateTable({
      ...base,
      rows: [
        { kind: 'door', id: 'shut', look: 'grate', w: 1, h: 2, at: { poi: 'world', x: 0, z: 0 } },
        { kind: 'plate', id: 'huge', size: 9, by: 'any', at: { poi: 'world', x: 0, z: 0 } },
        { kind: 'bench', id: 'far', label: 'Sit', at: { poi: 'hut', x: 80, z: 0 } },
      ],
    });
    expect(errs.join('\n')).toMatch(/can never open/);
    expect(errs.join('\n')).toMatch(/huge.*size out of range/);
    expect(errs.join('\n')).toMatch(/from its POI/);
  });
});
