// src/game/achievements.ts + src/game/Progress.ts — kills → achievement counts → earned titles → the worn title.
import { describe, expect, it, vi } from 'vitest';
import { loadSpecies } from './species';
import { achievementsFor, type AchievementDef } from '../src/game/achievements';
import { Progress } from '../src/game/Progress';
import { hasSpecies, speciesDef } from '../src/entities/species/registry';
import { CHUNKS } from '../src/chunks/registry';

const PINE = 'chunk://local/pine-hollow';
const STORE = 'ws.progress.v1';
loadSpecies();
const kill = (p: Progress, kind: string, variant: string | undefined, n: number): void => { for (let i = 0; i < n; i++) p.recordKill(kind, variant); };

describe('achievement tables', () => {
  it('Pine Hollow has its table; a shard without one gets an empty list', () => {
    expect(achievementsFor(PINE).length).toBeGreaterThan(0);
    expect(achievementsFor('chunk://local/nowhere')).toEqual([]);
  });

  it('every shard table has unique ids, positive integer counts, a name and a title', () => {
    for (const c of CHUNKS) {
      const defs = achievementsFor(c.id);
      expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
      for (const d of defs) {
        expect(Number.isInteger(d.count) && d.count > 0, d.id).toBe(true);
        expect(d.title.length, d.id).toBeGreaterThan(0);
        expect(d.name.length, d.id).toBeGreaterThan(0);
      }
    }
  });

  it('every achievement names a registered species and, if any, one of its variants (event rows excepted)', () => {
    for (const c of CHUNKS) {
      for (const d of achievementsFor(c.id)) {
        if (d.event === true) continue;   // recorded by the code that sees the moment (a tame, the Storm Titan), not a kill
        expect(hasSpecies(d.kind), `${d.id}: kind ${d.kind}`).toBe(true);
        if (d.variant !== undefined) expect(speciesDef(d.kind).variants.map((v) => v.id), d.id).toContain(d.variant);
      }
    }
  });

  it('Nalati has the tame, the Storm Titan and the elites, the event rows marked as such', () => {
    const n = achievementsFor('chunk://local/nalati-grasslands');
    const byId = (id: string): AchievementDef | undefined => n.find((d) => d.id === id);
    for (const id of ['tame', 'storm-titan', 'argymaq']) expect(byId(id)?.event, id).toBe(true);
    for (const id of ['aqbars', 'kokbori', 'qyran', 'qara-batyr', 'golden-king']) expect(byId(id), id).toBeDefined();
  });
});

describe('Progress', () => {
  it('counts kills up to the goal, then earns once and wears the first title', () => {
    const p = new Progress(PINE);
    const earned = vi.fn<(def: AchievementDef) => void>();
    p.onEarned = earned;
    kill(p, 'deer', 'hind', 4);
    expect(p.count('deer5')).toBe(4);
    expect(p.earned('deer5')).toBe(false);
    expect(p.title).toBeNull();
    p.recordKill('deer', 'hind');
    expect(p.earned('deer5')).toBe(true);
    expect(earned).toHaveBeenCalledTimes(1);
    expect(earned.mock.calls[0]?.[0]).toMatchObject({ id: 'deer5' });
    expect(p.title?.id).toBe('deer5');
    kill(p, 'deer', 'hind', 3);
    expect(p.count('deer5')).toBe(5); // capped at the goal
    expect(earned).toHaveBeenCalledTimes(1);
    expect(p.earnedCount).toBe(1);
  });

  it('a legendary counts for its own achievement and for the species one', () => {
    const p = new Progress(PINE);
    p.recordKill('deer', 'ghost');
    expect(p.earned('ghost')).toBe(true);
    expect(p.count('deer5')).toBe(1);
  });

  it('a variant achievement ignores the other variants', () => {
    const p = new Progress(PINE);
    kill(p, 'boar', 'black', 3);
    p.recordKill('boar');
    expect(p.count('ironhide')).toBe(0);
    expect(p.count('boar5')).toBe(4);
  });

  it('kills of an untracked kind change nothing and do not notify', () => {
    const p = new Progress(PINE);
    const changed = vi.fn<() => void>();
    p.onChange = changed;
    p.recordKill('crab', 'small');
    expect(changed).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORE)).toBeNull();
  });

  it('the first earned title stays worn; wear() switches only to earned ones', () => {
    const p = new Progress(PINE);
    p.recordKill('deer', 'ghost');           // earns 'ghost' → worn
    kill(p, 'bear', 'black', 2);             // earns 'bear2'
    expect(p.title?.id).toBe('ghost');
    const changed = vi.fn<() => void>();
    p.onChange = changed;
    p.wear('elk3');                          // not earned: ignored
    expect(p.title?.id).toBe('ghost');
    p.wear('ghost');                         // already worn: no-op
    expect(changed).not.toHaveBeenCalled();
    p.wear('bear2');
    expect(p.title?.id).toBe('bear2');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('rows mirror the table with counts, earned flags and the active title', () => {
    const p = new Progress(PINE);
    kill(p, 'elk', 'bull', 3);
    p.recordKill('boar', 'sow');
    const rows = p.rows;
    expect(rows.map((r) => r.def.id)).toEqual(achievementsFor(PINE).map((d) => d.id));
    expect(rows.find((r) => r.def.id === 'elk3')).toMatchObject({ count: 3, earned: true, active: true });
    expect(rows.find((r) => r.def.id === 'boar5')).toMatchObject({ count: 1, earned: false, active: false });
    expect(rows.filter((r) => r.active)).toHaveLength(1);
  });

  it('persists per shard across instances', () => {
    const a = new Progress(PINE);
    kill(a, 'bear', 'brown', 2);
    a.recordKill('deer');
    const b = new Progress(PINE);
    expect(b.earned('bear2')).toBe(true);
    expect(b.count('deer5')).toBe(1);
    expect(b.title?.id).toBe('bear2');
    expect(new Progress('chunk://local/driftwood-isle').earnedCount).toBe(0);
  });

  it('survives corrupt storage and a throwing setItem', () => {
    localStorage.setItem(STORE, 'nope{');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('private mode'); });
    const p = new Progress(PINE);
    kill(p, 'elk', 'cow', 3);
    expect(p.earned('elk3')).toBe(true);
  });
});
