// SF66 (G246 / G247): a shard's map ground is baked from its world (test/baked-maps.test.ts keeps it fresh); what is drawn on
// it stays listed data. Every place, entry, portal and quest marker a shard lists must land on its baked map (inside the
// square the bake covers), named and listed once, and the full map's pin source must carry every place; a dead entry (one
// off the map, unnamed or listed twice) fails.
import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the shipped shardfiles and map stamps.
import { existsSync, readFileSync } from 'node:fs';
import { SHARDS } from '../src/shards.generated';
import { toLevelSpec } from '../src/game/shard/spec';

const root = `${import.meta.dirname}/..`;
/** each shardfile project's parsed document (its shard.config.ts default export), keyed by slug */
const CONFIGS = new Map<string, unknown>();
for (const m of SHARDS) {
  if (!existsSync(`${root}/src/shards/${m.slug}/shard.config.ts`)) continue;
  const mod: unknown = await import(`../src/shards/${m.slug}/shard.config.ts`);
  CONFIGS.set(m.slug, typeof mod === 'object' && mod !== null && 'default' in mod ? mod.default : undefined);
}
interface Listed { kind: 'place' | 'entry' | 'portal' | 'quest'; id: string; label: string; x: number; z: number }
interface Stamp { image: string; metres: number }

/** every listed datum the map draws for a shard: its manifest's places, its shardfile's entryways (a lift / portal entry is a
 *  portal) and its quest markers (region triggers) */
function listed(slug: string, pois: readonly { id: string; name: string; x: number; z: number }[]): Listed[] {
  const out: Listed[] = pois.map((p) => ({ kind: 'place', id: p.id, label: p.name, x: p.x, z: p.z }));
  // the shard's own source document, not public/shardfiles (git-ignored build output the gate writes in parallel with vitest)
  const shard: unknown = CONFIGS.get(slug);
  if (shard === undefined) return out;
  if (typeof shard !== 'object' || shard === null) throw new Error(`${slug}/shard.config.ts: not a shardfile`);
  const entryways: unknown = 'entryways' in shard ? shard.entryways : [];
  for (const e of Array.isArray(entryways) ? entryways : []) {
    const { at, edge } = e as { at: readonly number[]; edge: string; lift?: unknown; portal?: unknown };
    out.push({ kind: 'lift' in e || 'portal' in e ? 'portal' : 'entry', id: edge, label: edge, x: at[0] ?? Number.NaN, z: at[2] ?? Number.NaN });
  }
  const quests: unknown = 'quests' in shard ? shard.quests : undefined;
  const triggers: unknown = typeof quests === 'object' && quests !== null && 'triggers' in quests ? quests.triggers : [];
  for (const t of Array.isArray(triggers) ? triggers : []) {
    const { id, x, z } = t as { id: string; x?: number; z?: number };
    if (x !== undefined && z !== undefined) out.push({ kind: 'quest', id, label: id, x, z });
  }
  return out;
}

/** the dead entries: off the baked map's square, unnamed, or listed twice */
function dead(items: readonly Listed[], metres: number): string[] {
  const half = metres / 2, seen = new Set<string>(), out: string[] = [];
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    if (!Number.isFinite(item.x) || !Number.isFinite(item.z) || Math.abs(item.x) > half || Math.abs(item.z) > half) out.push(`${key} at (${item.x}, ${item.z}) is off the map`);
    if (item.label.trim() === '') out.push(`${key} has no name`);
    if (seen.has(key)) out.push(`${key} is listed twice`);
    seen.add(key);
  }
  return out;
}

describe('map coverage (SF66: listed data on the baked map)', () => {
  it('covers every shard', () => { expect(SHARDS.length).toBeGreaterThanOrEqual(7); });
  for (const m of SHARDS) {
    it(`${m.slug}: names its baked map, and every place, entry, portal and quest marker is on it`, () => {
      const stamp = JSON.parse(readFileSync(`${root}/src/shards/${m.slug}/look/map.baked.json`, 'utf8')) as Stamp;
      expect(m.minimap?.image, `${m.slug} draws no baked map (minimap.image)`).toBeDefined();
      expect(m.minimap?.image).toBe(stamp.image);
      expect(toLevelSpec(m).minimap.image?.split('?')[0]).toBe(stamp.image); // what the minimap fetches
      const items = listed(m.slug, m.pois ?? []);
      expect(dead(items, stamp.metres)).toEqual([]);
      expect(items.filter((i) => i.kind === 'entry' || i.kind === 'portal')).toHaveLength(4); // the four midpoint entryways
      // the full map's default pins (Map.ts levelPins) read the level's places: every listed place reaches it
      expect(toLevelSpec(m).pois?.map((p) => p.id) ?? []).toEqual((m.pois ?? []).map((p) => p.id));
    });
  }
  it('a dead entry fails: off the map, unnamed or listed twice (fixture)', () => {
    const ok: Listed = { kind: 'place', id: 'hut', label: 'Hut', x: 10, z: -20 };
    expect(dead([ok, { kind: 'entry', id: 'north', label: 'north', x: 0, z: 250 }], 500)).toEqual([]);
    expect(dead([ok, { kind: 'place', id: 'tower', label: 'Tower', x: 260, z: 0 }], 500)).toEqual(['place:tower at (260, 0) is off the map']);
    expect(dead([{ ...ok, label: ' ' }], 500)).toEqual(['place:hut has no name']);
    expect(dead([ok, ok], 500)).toEqual(['place:hut is listed twice']);
  });
});
