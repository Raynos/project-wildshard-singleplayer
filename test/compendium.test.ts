// src/ui/compendium/ — the Compendium engine: Pine Hollow's table against the real species / POIs / shipped art, the entry
// state machine (unknown → discovered → seen → taken, forward only), its per-shard save, and the tracker's hooks.
import { describe, expect, it, vi } from 'vitest';
import { loadSpecies } from './species';
import { hasSpecies, speciesDef } from '../src/entities/species/registry';
import { PINE_HOLLOW_POIS } from '../src/chunks/pineHollowLayout';
import { PINE_HOLLOW_COMPENDIUM } from '../src/ui/compendium/shards/pine-hollow';
import { compendiumFor, registerCompendium } from '../src/ui/compendium/registry';
import { COMPENDIUM_STORE, CompendiumState } from '../src/ui/compendium/state';
import { CompendiumTracker, HEAR, SPOT, type TrackedAnimal } from '../src/ui/compendium/tracker';
import type { ShardCompendium } from '../src/ui/compendium/types';

loadSpecies();
const PH = PINE_HOLLOW_COMPENDIUM;
/** the shipped journal art (keys only: the files are never loaded) */
const SHIPPED = new Set(Object.keys(import.meta.glob('../public/assets/pine-hollow/journal/*.webp', { query: '?url' })).map((k) => k.replace('../public', '')));
const shipped = (path: string): boolean => SHIPPED.has(path);
const fresh = (def: ShardCompendium = PH): CompendiumState => new CompendiumState(def);

describe("Pine Hollow's table", () => {
  it('registers, and a shard without one has none', () => {
    registerCompendium(PH);
    expect(compendiumFor(PH.chunkId)).toBe(PH);
    expect(compendiumFor('chunk://local/nowhere')).toBeUndefined();
  });

  it('every animal entry matches real species variants, and no variant is claimed twice', () => {
    const claimed = new Map<string, string>();
    for (const e of PH.entries) {
      if (!e.match || e.kind === 'boss') continue; // the Antler King's kind lands with the boss (PH-C2)
      expect(hasSpecies(e.match.kind), e.id).toBe(true);
      const ids = speciesDef(e.match.kind).variants.map((v) => v.id);
      for (const v of e.match.variants ?? []) {
        expect(ids, `${e.id} → ${v}`).toContain(v);
        const key = `${e.match.kind}:${v}`;
        expect(claimed.get(key), key).toBeUndefined();
        claimed.set(key, e.id);
      }
      expect(e.massKg, e.id).toBeGreaterThan(0);
    }
    // every variant of the four huntable species has a page
    for (const kind of ['deer', 'boar', 'elk', 'bear']) for (const v of speciesDef(kind).variants) expect(claimed.has(`${kind}:${v.id}`), `${kind}:${v.id}`).toBe(true);
  });

  it('has a page per POI, the elites and the King, and every tab is used', () => {
    for (const p of PINE_HOLLOW_POIS) expect(PH.entries.find((e) => e.id === p.id)?.kind, p.id).toBe('place');
    expect(PH.entries.filter((e) => e.kind === 'elite').map((e) => e.id).sort()).toEqual(['blackpaw', 'ghost-stag', 'imperial-bull', 'ironhide']);
    expect(PH.entries.find((e) => e.kind === 'boss')?.id).toBe('antler-king');
    for (const t of PH.skin.tabs) if (t.id !== PH.skin.trophyTab) expect(PH.entries.some((e) => e.tab === t.id), t.id).toBe(true);
  });

  it('ships every plate, every beast silhouette and the chalk atlas', () => {
    for (const e of PH.entries) {
      expect(shipped(e.plate.sketch), e.plate.sketch).toBe(true);
      if (e.kind !== 'place') expect(shipped(e.plate.sketch.replace(/\.webp$/, '-sil.webp')), e.id).toBe(true);
    }
    const chalk = PH.skin.chalk;
    expect(chalk !== undefined && shipped(chalk.atlas)).toBe(true);
  });

  it('every trophy slot mounts a real variant of its own entry and has a chalk cell', () => {
    const cells = PH.skin.chalk?.cells ?? {};
    for (const t of PH.trophies ?? []) {
      const e = PH.entries.find((x) => x.id === t.entry);
      expect(e, t.entry).toBeDefined();
      expect(cells[t.outline], t.outline).toBeDefined();
      if (t.mount) expect(e?.match?.kind === t.mount.kind && e.match.variants?.includes(t.mount.variant), t.entry).toBe(true);
    }
    const rows = PH.wall?.rows ?? [];
    expect(rows.reduce((a, b) => a + b, 0)).toBe(PH.trophies?.length);
  });
});

describe('the entry state machine', () => {
  it('moves forward only: unknown → discovered → seen → taken', () => {
    const s = fresh();
    const changes: string[] = [];
    s.onChange = (e, from, to) => { changes.push(`${e.id}:${from}>${to}`); };
    expect(s.state('red-deer')).toBe('unknown');
    s.animalNear('deer', 'stag');
    expect(s.state('red-deer')).toBe('discovered');
    s.animalSpotted('deer', 'hind');
    s.animalSpotted('deer', 'stag');
    expect(s.stats('red-deer')).toMatchObject({ state: 'seen', seen: 2, taken: 0 });
    s.animalKilled('deer', 'stag', 187.4);
    s.animalKilled('deer', 'hind', 96);
    expect(s.stats('red-deer')).toEqual({ state: 'taken', seen: 2, taken: 2, best: 187 });
    s.animalNear('deer', 'stag'); s.animalSpotted('deer', 'stag'); // never back
    expect(s.state('red-deer')).toBe('taken');
    expect(changes).toEqual(['red-deer:unknown>discovered', 'red-deer:discovered>seen', 'red-deer:seen>taken']);
  });

  it('routes a variant to its own page (the Ghost stag is an elite, not a red deer)', () => {
    const s = fresh();
    s.animalKilled('deer', 'ghost', 270);
    expect(s.state('ghost-stag')).toBe('taken');
    expect(s.state('red-deer')).toBe('unknown');
    s.animalKilled('bear', 'black-old', 300);
    expect(s.state('blackpaw')).toBe('taken');
    expect(s.state('black-bear')).toBe('unknown');
    s.animalKilled('bear', undefined, 100); // no variant: no page answers
    expect(s.count('beasts', 'taken')).toBe(0);
  });

  it('a kill you never saw still takes the page; a place is visited, never taken', () => {
    const s = fresh();
    s.animalKilled('boar', 'scarback', 180);
    expect(s.stats('scarback')).toEqual({ state: 'taken', seen: 0, taken: 1, best: 180 });
    expect(s.take('pond')).toBe(false);
    s.placeNear('pond');
    expect(s.state('pond')).toBe('discovered');
    s.placeVisited('pond'); s.placeVisited('pond');
    expect(s.stats('pond')).toMatchObject({ state: 'seen', seen: 2 });
    s.placeVisited('red-deer'); // not a place
    expect(s.state('red-deer')).toBe('unknown');
  });

  it('the King stays ??? until something of kind antler-king exists', () => {
    const s = fresh();
    for (const k of ['deer', 'boar', 'elk', 'bear']) for (const v of speciesDef(k).variants) s.animalKilled(k, v.id, 1);
    expect(s.state('antler-king')).toBe('unknown');
    s.animalKilled('antler-king', undefined, 0);
    expect(s.state('antler-king')).toBe('taken');
  });
});

describe('the save (ws.compendium.v1, per shard)', () => {
  it('round-trips through localStorage, keyed by chunk id', () => {
    const a = fresh();
    a.animalSpotted('elk', 'bull'); a.animalKilled('elk', 'imperial', 686); a.placeVisited('lookout');
    const b = fresh();
    expect(b.stats('elk')).toMatchObject({ state: 'seen', seen: 1 });
    expect(b.stats('imperial-bull')).toMatchObject({ state: 'taken', taken: 1, best: 686 });
    expect(b.state('lookout')).toBe('seen');
    const other = fresh({ ...PH, chunkId: 'chunk://local/elsewhere' });
    expect(other.state('elk')).toBe('unknown');
    const all = JSON.parse(localStorage.getItem(COMPENDIUM_STORE) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(all)).toEqual([PH.chunkId]);
  });

  it('loads a corrupt or hostile save as empty / clamped, and drops unknown ids', () => {
    localStorage.setItem(COMPENDIUM_STORE, '{not json');
    expect(fresh().state('elk')).toBe('unknown');
    localStorage.setItem(COMPENDIUM_STORE, JSON.stringify({ [PH.chunkId]: { elk: { s: 99, n: -4, t: 'x', b: -7 }, nope: { s: 3 }, boar: null } }));
    const s = fresh();
    expect(s.stats('elk')).toEqual({ state: 'taken', seen: 0, taken: 0, best: 0 });
    expect(s.entry('nope')).toBeUndefined();
    s.animalSpotted('boar', 'boar');
    const saved = (JSON.parse(localStorage.getItem(COMPENDIUM_STORE) ?? '{}') as Record<string, Record<string, unknown>>)[PH.chunkId] ?? {};
    expect(Object.keys(saved).sort()).toEqual(['boar', 'elk']);
  });

  it('keeps playing in memory when storage throws (iOS private mode)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const s = fresh();
    s.animalKilled('boar', 'ironhide', 270);
    expect(s.state('ironhide')).toBe('taken');
  });
});

describe('the tracker', () => {
  const animal = (kind: string, variant: string, x: number, z: number, scale = 1): TrackedAnimal => ({ kind, variant, alive: true, hidden: false, position: { x, y: 0, z }, scale });
  const eye = { position: { x: 0, y: 0.8, z: 0 }, forward: { x: 0, y: 0, z: 1 } };

  it('hears within HEAR m, spots in the view cone within SPOT m, once per individual', () => {
    const s = fresh(), t = new CompendiumTracker(s);
    const far = animal('elk', 'cow', 0, HEAR + 5), mid = animal('boar', 'boar', 0, SPOT + 10), near = animal('deer', 'hind', 3, 30), behind = animal('bear', 'black', 0, -20);
    for (let i = 0; i < 4; i++) t.update(0.3, eye, [far, mid, near, behind]);
    expect(s.state('elk')).toBe('unknown');
    expect(s.state('boar')).toBe('discovered');
    expect(s.stats('red-deer')).toMatchObject({ state: 'seen', seen: 1 });
    expect(s.state('black-bear')).toBe('discovered');
  });

  it('respects the line of sight and skips the dead and the hidden', () => {
    const s = fresh(), t = new CompendiumTracker(s, { canSee: () => false });
    t.update(1, eye, [animal('deer', 'stag', 0, 20)]);
    expect(s.state('red-deer')).toBe('discovered');
    const s2 = fresh(), t2 = new CompendiumTracker(s2);
    t2.update(1, eye, [{ ...animal('elk', 'bull', 0, 20), alive: false }, { ...animal('boar', 'boar', 0, 20), hidden: true }]);
    expect(s2.state('elk')).toBe('unknown');
    expect(s2.state('boar')).toBe('unknown');
  });

  it('weighs a kill by the entry mass × scale³', () => {
    const s = fresh(), t = new CompendiumTracker(s);
    t.killed(animal('elk', 'imperial', 0, 5, 1.4));
    expect(s.stats('imperial-bull').best).toBe(Math.round(250 * 1.4 ** 3));
  });

  it('counts a visit on the way into a place, not every poll inside it', () => {
    const s = fresh(), t = new CompendiumTracker(s);
    const pond = PINE_HOLLOW_POIS.find((p) => p.id === 'pond');
    if (!pond) throw new Error('no pond');
    const at = (x: number, z: number) => ({ position: { x, y: 0, z }, forward: { x: 0, y: 0, z: 1 } });
    t.update(1, at(pond.x + pond.r * 2, pond.z), []);
    expect(s.state('pond')).toBe('discovered');
    for (let i = 0; i < 5; i++) t.update(1, at(pond.x, pond.z), []);
    expect(s.stats('pond').seen).toBe(1);
    t.update(1, at(pond.x + pond.r + 10, pond.z), []);
    t.update(1, at(pond.x, pond.z), []);
    expect(s.stats('pond').seen).toBe(2);
  });
});
