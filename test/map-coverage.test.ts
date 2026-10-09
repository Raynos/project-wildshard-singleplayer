// SF66 (G246 / G247): a shard's map ground is baked from its world (test/baked-maps.test.ts keeps it fresh); what is drawn on
// it stays listed data. Every place, entry, portal and quest marker a shard lists must land on its baked map (inside the
// square the bake covers), named and listed once, and the full map's pin source must carry every place; a dead entry (one
// off the map, unnamed or listed twice) fails. The other way round: every POI-bearing datum in a shard's shardfile (a portal or
// lift entry, a quest trigger, an interaction, a map marker, an encounter's arena, a boss, a mover) must sit on a listed place
// or match a reviewed lint/map-ignore.json entry with its reason, and an ignore entry that matches nothing fails (dead).
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

/** metres: a POI-bearing datum this close to a listed place (or inside the place's own radius) is on the map under that name */
const COVER_M = 20;
/** a thing in the shard's world the map must show: a portal / lift entry, a quest trigger, an interaction, a map marker, an
 *  encounter's arena, a boss's spawn, a mover (an islet that rises, a gate isle); its key is `<kind>:<id>` */
interface Datum { key: string; x: number; z: number }
interface Ignore { pattern: string; reason: string }
type Row = Readonly<Record<string, unknown>>;
const isRow = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const field = (o: unknown, k: string): unknown => (isRow(o) ? o[k] : undefined);
const rows = (v: unknown): readonly Row[] => (Array.isArray(v) ? v.filter(isRow) : []);
const num = (n: unknown): number => (typeof n === 'number' ? n : Number.NaN);
const xz = (at: unknown): [number, number] => {
  if (Array.isArray(at)) return at.length === 2 ? [num(at[0]), num(at[1])] : [num(at[0]), num(at[2])];
  return [num(field(at, 'x')), num(field(at, 'z'))];
};
/** every POI-bearing datum in a shard's shardfile document (its shard.config.ts default export) */
function poiBearing(shard: unknown): Datum[] {
  const out: Datum[] = [], push = (key: string, at: [number, number]): void => { out.push({ key, x: at[0], z: at[1] }); };
  const id = (r: Row): string => String(field(r, 'id')), at = (r: Row): [number, number] => xz(field(r, 'at'));
  for (const e of rows(field(shard, 'entryways'))) {
    const portal = field(e, 'portal'), lift = field(e, 'lift'), edge = String(field(e, 'edge'));
    if (portal !== undefined) push(`portal:${edge}`, xz(field(field(portal, 'road'), 'at')));
    else if (lift !== undefined) push(`lift:${edge}`, xz(field(lift, 'roadStop')));
  }
  for (const t of rows(field(field(shard, 'quests'), 'triggers'))) {
    const x = field(t, 'x'), z = field(t, 'z');
    if (typeof x === 'number' && typeof z === 'number') push(`quest:${id(t)}`, [x, z]);
  }
  for (const t of rows(field(field(shard, 'targets'), 'interactions'))) push(`interaction:${id(t)}`, at(t));
  for (const u of rows(field(shard, 'ui'))) if (field(u, 'kind') === 'marker') push(`marker:${id(u)}`, at(u));
  for (const e of rows(field(shard, 'encounters'))) push(`encounter:${id(e)}`, xz(field(field(e, 'arena'), 'at')));
  for (const b of rows(field(field(field(shard, 'runtime'), 'spawns'), 'bosses'))) push(`boss:${id(b)}`, at(b));
  for (const m of rows(field(shard, 'movers'))) push(`mover:${id(m)}`, at(m));
  return out;
}
const matches = (pattern: string, key: string): boolean => (pattern.endsWith('*') ? key.startsWith(pattern.slice(0, -1)) : key === pattern);
/** the verdict: a datum near no listed place and matched by no ignore entry is missing from the map; an ignore entry with no
 *  reason, or matching no datum off the listed places, is dead */
function coverage(data: readonly Datum[], places: readonly { x: number; z: number; r?: number }[], ignore: readonly Ignore[]): { missing: string[]; dead: string[] } {
  const near = (d: Datum): boolean => places.some((p) => Math.hypot(p.x - d.x, p.z - d.z) <= Math.max(p.r ?? 0, COVER_M));
  const uncovered = data.filter((d) => !near(d));
  return {
    missing: uncovered.filter((d) => !ignore.some((i) => matches(i.pattern, d.key)))
      .map((d) => `${d.key} at (${String(Math.round(d.x))}, ${String(Math.round(d.z))}) is on no listed place (add one to the manifest's pois, or a reviewed lint/map-ignore.json entry)`),
    dead: ignore.filter((i) => i.reason.trim().length < 10 || !uncovered.some((d) => matches(i.pattern, d.key)))
      .map((i) => `${i.pattern}: ${i.reason.trim().length < 10 ? 'says no reason' : 'matches nothing off the listed places (dead)'}`),
  };
}
/** lint/map-ignore.json: the reviewed POI-bearing data a shard's map leaves off its listed places, a reason per entry */
function readIgnores(): Readonly<Record<string, readonly Ignore[]>> {
  const doc: unknown = JSON.parse(readFileSync(`${root}/lint/map-ignore.json`, 'utf8'));
  const shards = field(doc, 'shards');
  if (!isRow(shards)) throw new Error('lint/map-ignore.json: no "shards"');
  const out: Record<string, Ignore[]> = {};
  for (const [slug, entries] of Object.entries(shards)) {
    out[slug] = rows(entries).map((e) => {
      const pattern = field(e, 'pattern'), reason = field(e, 'reason');
      if (typeof pattern !== 'string' || typeof reason !== 'string') throw new Error(`lint/map-ignore.json ${slug}: each entry is { pattern, reason }`);
      return { pattern, reason };
    });
  }
  return out;
}
const IGNORES = readIgnores();

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
    it(`${m.slug}: every portal, lift, quest trigger, interaction, marker, arena, boss and mover is on a listed place (or reviewed)`, () => {
      const shard = CONFIGS.get(m.slug);
      if (shard === undefined) return;
      expect(coverage(poiBearing(shard), m.pois ?? [], IGNORES[m.slug] ?? [])).toEqual({ missing: [], dead: [] });
    });
  }
  it('lint/map-ignore.json names only shards that exist', () => {
    expect(Object.keys(IGNORES).filter((slug) => !SHARDS.some((m) => m.slug === slug))).toEqual([]);
  });
  it('a piece added without a place fails; a reviewed ignore passes it; a dead or unexplained ignore fails (fixture)', () => {
    const places = [{ x: 0, z: 0, r: 24 }], hut: Datum = { key: 'interaction:hut.door', x: 5, z: -3 };
    expect(coverage([hut], places, [])).toEqual({ missing: [], dead: [] });
    const added: Datum = { key: 'quest:new-shrine', x: 120, z: 90 };
    expect(coverage([hut, added], places, []).missing).toEqual(['quest:new-shrine at (120, 90) is on no listed place (add one to the manifest\'s pois, or a reviewed lint/map-ignore.json entry)']);
    expect(coverage([hut, added], places, [{ pattern: 'quest:new-*', reason: 'a hidden shrine found by ear' }])).toEqual({ missing: [], dead: [] });
    expect(coverage([hut], places, [{ pattern: 'quest:gone', reason: 'a shrine that was removed' }]).dead).toEqual(['quest:gone: matches nothing off the listed places (dead)']);
    expect(coverage([hut], places, [{ pattern: 'interaction:hut.*', reason: 'the hut is on the map' }]).dead).toEqual(['interaction:hut.*: matches nothing off the listed places (dead)']);
    expect(coverage([added], places, [{ pattern: 'quest:new-shrine', reason: '' }]).dead).toEqual(['quest:new-shrine: says no reason']);
    // the shardfile reader: a lift entry at its road stop, a plain entry not at all, a marker but not a counter
    expect(poiBearing({ entryways: [{ edge: 'north', at: [0, 0, 250], lift: { roadStop: [0, 0, 228] } }, { edge: 'east', at: [250, 0, 0] }], ui: [{ kind: 'marker', id: 'pin', at: [1, 2, 3] }, { kind: 'counter', id: 'c' }] }))
      .toEqual([{ key: 'lift:north', x: 0, z: 228 }, { key: 'marker:pin', x: 1, z: 3 }]);
  });
  it('a dead entry fails: off the map, unnamed or listed twice (fixture)', () => {
    const ok: Listed = { kind: 'place', id: 'hut', label: 'Hut', x: 10, z: -20 };
    expect(dead([ok, { kind: 'entry', id: 'north', label: 'north', x: 0, z: 250 }], 500)).toEqual([]);
    expect(dead([ok, { kind: 'place', id: 'tower', label: 'Tower', x: 260, z: 0 }], 500)).toEqual(['place:tower at (260, 0) is off the map']);
    expect(dead([{ ...ok, label: ' ' }], 500)).toEqual(['place:hut has no name']);
    expect(dead([ok, ok], 500)).toEqual(['place:hut is listed twice']);
  });
});
