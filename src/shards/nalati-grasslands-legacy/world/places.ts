/**
 * Nalati's named places as Sets (E306 / E315 M12, Jake 2026-09-30: "every named place is a Set"). The shard names its
 * places in its discovery list (`NALATI_PLACES`, src/shards/nalati-grasslands/quest.ts: the full map's 17 labels); each is ONE set
 * here, `place: 'nalati-grasslands/<id>'`, listing the models placed in that place. A place built as one POI (the
 * spring camp, the kurgan field, the Kokpar field …) holds that POI's placed models whole, and only its place does;
 * every place also holds the copies of the shard's other models — the escarpment's rocks, the crag rock, the dressing's
 * boulders, plants and props, the roads' fences and signposts, the herds — that stand within its radius (a slice of
 * their `place` call). A place's welded ground (the
 * kurgan domes, the glacier's tongue, the river's bed) stays world, and the moving life (herds excepted, boxed where
 * they start) is not a placement.
 *
 *   const n = await registerNalatiPlaces({ registry, pois: pois.placed, others: [...rocks, ...dressing.placed], yieldTask });
 */
import * as THREE from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import { placeSet } from '@wildshard/engine/models/sets';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import { NALATI_PLACES } from '../quest';

interface PlaceRow {
  /** the named place (`nalati-grasslands/<NALATI_PLACES id>`) */
  readonly place: string;
  /** the set's id (a POI's set keeps the id it had) and name */
  readonly id: string;
  readonly name: string;
  /** the module that composes it */
  readonly file: string;
  /** the POIs (NalatiPOIs' piece names) whose placed models are this place's, whole */
  readonly pois?: readonly string[];
}

/** every named place's set (the place ids are string literals: scripts/check-models.mjs reads them) */
export const PLACE_SETS: readonly PlaceRow[] = [
  { place: 'nalati-grasslands/nomad-camp', id: 'nalati-grasslands/spring-camp', name: 'Spring camp', file: 'src/shards/nalati-grasslands/world/NomadCamp.ts', pois: ['camp'] },
  { place: 'nalati-grasslands/sheep-pasture', id: 'nalati-grasslands/sheep-pasture', name: 'Sheep pasture', file: 'src/shards/nalati-grasslands/world/places.ts' },
  { place: 'nalati-grasslands/bridge', id: 'nalati-grasslands/bridge', name: 'The Kunes bridge', file: 'src/shards/nalati-grasslands/world/Bridge.ts', pois: ['bridge'] },
  { place: 'nalati-grasslands/kunes-river', id: 'nalati-grasslands/kunes-river', name: 'The Kunes river', file: 'src/shards/nalati-grasslands/world/places.ts' },
  { place: 'nalati-grasslands/sky-road', id: 'nalati-grasslands/sky-road', name: 'The sky road', file: 'src/shards/nalati-grasslands/world/places.ts' },
  { place: 'nalati-grasslands/eagle-rock', id: 'nalati-grasslands/eagle-rock-knoll', name: 'Eagle Rock', file: 'src/shards/nalati-grasslands/world/EagleRock.ts', pois: ['eagleRock'] },
  { place: 'nalati-grasslands/horse-plains', id: 'nalati-grasslands/horse-plains', name: 'The horse plains', file: 'src/shards/nalati-grasslands/world/places.ts' },
  { place: 'nalati-grasslands/kokpar-field', id: 'nalati-grasslands/kokpar-field', name: 'Kokpar field', file: 'src/shards/nalati-grasslands/world/Bowl.ts', pois: ['kokpar'] },
  { place: 'nalati-grasslands/kurgan-field', id: 'nalati-grasslands/kurgan-field', name: 'Kurgan field', file: 'src/shards/nalati-grasslands/world/KurganField.ts', pois: ['kurgans', 'balbals'] },
  { place: 'nalati-grasslands/great-kurgan', id: 'nalati-grasslands/great-kurgan', name: 'The great kurgan', file: 'src/shards/nalati-grasslands/world/places.ts' },
  { place: 'nalati-grasslands/summer-camp', id: 'nalati-grasslands/summer-camp', name: 'Summer camp', file: 'src/shards/nalati-grasslands/world/SummerCamp.ts', pois: ['summerCamp'] },
  { place: 'nalati-grasslands/watchtower', id: 'nalati-grasslands/watchtower-hill', name: 'Watchtower hill', file: 'src/shards/nalati-grasslands/world/Bowl.ts', pois: ['watchtower'] },
  { place: 'nalati-grasslands/wind-cairn', id: 'nalati-grasslands/wind-cairn-rise', name: 'The Wind Cairn', file: 'src/shards/nalati-grasslands/world/Cairn.ts', pois: ['cairn'] },
  { place: 'nalati-grasslands/glacier', id: 'nalati-grasslands/glacier', name: 'The glacier', file: 'src/shards/nalati-grasslands/world/places.ts' },
  { place: 'nalati-grasslands/snow-leopard-cave', id: 'nalati-grasslands/crags', name: "Aqbars' ledges and cave", file: 'src/shards/nalati-grasslands/world/Crags.ts', pois: ['crags'] },
  { place: 'nalati-grasslands/the-crags', id: 'nalati-grasslands/the-crags', name: 'The Crags', file: 'src/shards/nalati-grasslands/world/places.ts' },
  { place: 'nalati-grasslands/snow-lotus', id: 'nalati-grasslands/snow-lotus-meadow', name: 'Snow lotus meadow', file: 'src/shards/nalati-grasslands/world/Bowl.ts', pois: ['snowLotus'] },
];

const _b = new THREE.Box3(), _c = new THREE.Vector3();

/**
 * The copies of `p` whose box centre stands within `r` of (x, z): a view of them (their boxes, their count; the object
 * that draws them is the group's; a slice carries no colliders of its own — they are its group's). Null when none.
 */
function slice(p: Placed, x: number, z: number, r: number): Placed | null {
  const idx: number[] = [];
  for (let i = 0; i < p.copies; i++) {
    p.copyBox(i, _b).getCenter(_c);
    if ((_c.x - x) ** 2 + (_c.z - z) ** 2 <= r * r) idx.push(i);
  }
  if (idx.length === 0) return null;
  if (idx.length === p.copies) return p;
  const at = Uint32Array.from(idx);
  return {
    model: p.model, object: p.object, colliders: [], copies: at.length, drawnAs: p.drawnAs, cull: p.cull,
    copyBox: (i, target) => p.copyBox(at[i] ?? 0, target),
    nearest: (q) => {
      let bi = -1, bd = Number.POSITIVE_INFINITY;
      for (let i = 0; i < at.length; i++) { p.copyBox(at[i] ?? 0, _b).getCenter(_c); const d = _c.distanceToSquared(q); if (d < bd) { bd = d; bi = i; } }
      return bi;
    },
    get registered() { return p.registered; },
  };
}

/** Register every named place's set (a task apart); returns how many sets were registered. */
export async function registerNalatiPlaces(o: {
  readonly registry: WorldRegistry;
  /** each POI's placed models (NalatiPOIs.placed) */
  readonly pois: ReadonlyMap<string, readonly Placed[]>;
  /** the shard's other placed models (the rocks, the dressing) */
  readonly others: readonly Placed[];
  readonly yieldTask: () => Promise<void>;
}): Promise<number> {
  // a POI's models are its own place's; the POIs no place claims (the roads, the herds) are sliced like the others
  const claimed = new Set(PLACE_SETS.flatMap((r) => r.pois ?? []));
  const loose = [...o.pois].filter(([name]) => !claimed.has(name)).flatMap(([, placed]) => placed);
  let n = 0;
  for (const row of PLACE_SETS) {
    const where = NALATI_PLACES.find((p) => `nalati-grasslands/${p.id}` === row.place);
    if (!where) throw new Error(`registerNalatiPlaces: ${row.place} is not in NALATI_PLACES`);
    const whole = (row.pois ?? []).flatMap((name) => o.pois.get(name) ?? []);
    const members = [...whole];
    for (const p of [...loose, ...o.others]) {
      const s = slice(p, where.x, where.z, where.r);
      if (s) members.push(s);
    }
    if (members.length > 0) { placeSet({ id: row.id, name: row.name, file: row.file, place: row.place, members, registry: o.registry }); n++; }
    await o.yieldTask();
  }
  return n;
}
