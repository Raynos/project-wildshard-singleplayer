/**
 * The fire lookout (E315 M2; PINE-HOLLOW-REMASTER PH-B3), on the cabins' timber kit (../world/timber.ts): four splayed
 * peeled-log legs with girts and X-bracing, a stair of five flights inside a railed cage (treads the character climbs), a
 * 6 m deck with a railing, the glazed cab with a hipped moss roof, and the zipline's launch jutting off the deck. Its
 * frame: local −Z faces down the cable to the landing, local +X the trail's arrival (the stair's door); the origin on the
 * crag-top pad. Placed once on the Ridge (src/shards/pine-hollow/world/landmarks.ts), its anchors (`zipTop`, `launch`)
 * handed to the ride. One merged mesh per material; the detail set drops past the cabins' detail distance.
 *
 * Built offline (G285, SF72 "bake the code-built worlds"): `../generators/fireLookout.ts` (`scripts/bake-pine-lookout.mjs`)
 * leaves each material's parts and the glass in `public/assets/pine-hollow/baked/lookout.bin` and the colliders, floors and
 * anchors in `../data/lookout.json`; here the timber is finished from them, as the builder's own timber was.
 *
 *   await loadFireLookout(ctx);   // with loadTimber(ctx): place() is synchronous, the bake first
 */
import * as THREE from 'three';
import * as v from 'valibot';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { MatKey } from '../world/homestead';
import { fetchBake } from '../world/bakeBytes';
import { Timber, timberFacts, timberMats } from '../world/timber';
import lookoutJson from '../data/lookout.json' with { type: 'json' };

/** the timber's name and its stream (the level seed + this) */
export const LOOKOUT_NAME = 'fire-lookout';
export const LOOKOUT_SEED = 901;
/** the bake's binary (`scripts/bake-pine-lookout.mjs`); listed in the boot's world reads (../boot/files.ts) */
export const LOOKOUT_BAKE_URL = '/assets/pine-hollow/baked/lookout.bin';

const num = v.pipe(v.number(), v.finite());
const xyz = v.strictObject({ x: num, y: num, z: num });
const Surface = v.optional(v.picklist(['wood', 'stone']));
const Box = v.strictObject({ kind: v.literal('box'), x: num, y: num, z: num, hx: num, hy: num, hz: num, yaw: v.optional(num), rot: v.optional(v.strictObject({ x: num, y: num, z: num, w: num })), surface: Surface });
const Treads = v.strictObject({ kind: v.literal('treads'), from: xyz, to: xyz, width: num, count: num, surface: Surface });
const Floor = v.strictObject({ x: num, z: num, rot: num, hw: num, hd: num, y: num });
/** the timber kit's materials (homestead.ts `MatKey`) */
const MAT_KEYS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const satisfies readonly MatKey[];
const Part = v.strictObject({ key: v.picklist(MAT_KEYS), counts: v.array(num) });
export const LookoutRowsSchema = v.strictObject({ bin: v.string(), bytes: num, seed: num, parts: v.array(Part), glass: v.array(num), colliders: v.array(v.variant('kind', [Box, Treads])), floors: v.array(Floor), anchors: v.record(v.string(), v.tuple([num, num, num])) });
export type LookoutRows = v.InferOutput<typeof LookoutRowsSchema>;
/** the bake's rows, parsed strictly once */
export const LOOKOUT_ROWS: LookoutRows = v.parse(LookoutRowsSchema, lookoutJson);

const KEY = 'pine-hollow/fire-lookout:bake';
/** the attribute blocks of each part, in the binary's order: position (3), normal (3), uv (2), float32, non-indexed */
const ATTRS = [['position', 3], ['normal', 3], ['uv', 2]] as const;

/** the bake's parts and glass as the builder left them (fresh geometries, read from `bytes`) */
export function lookoutParts(bytes: Uint8Array, rows: LookoutRows): { parts: Map<MatKey, THREE.BufferGeometry[]>; glass: THREE.BufferGeometry[] } {
  if (bytes.byteLength !== rows.bytes) throw new Error(`[lookout] the bake holds ${String(bytes.byteLength)} bytes, its rows ${String(rows.bytes)}`);
  const floats = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  let at = 0;
  const geometry = (n: number): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    for (const [name, size] of ATTRS) { g.setAttribute(name, new THREE.BufferAttribute(floats.slice(at, at + n * size), size)); at += n * size; }
    return g;
  };
  const parts = new Map<MatKey, THREE.BufferGeometry[]>();
  for (const { key, counts } of rows.parts) parts.set(key, counts.map(geometry));
  const glass = rows.glass.map(geometry);
  if (at !== floats.length) throw new Error('[lookout] the bake is longer than its rows');
  return { parts, glass };
}

/** a collider row as the timber kit made it */
function colliderOf(c: LookoutRows['colliders'][number]): ColliderDesc {
  const surface = c.surface === undefined ? {} : { surface: c.surface };
  if (c.kind === 'treads') return { kind: 'treads', from: c.from, to: c.to, width: c.width, count: c.count, ...surface };
  return { kind: 'box', x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...(c.yaw === undefined ? {} : { yaw: c.yaw }), ...(c.rot === undefined ? {} : { rot: c.rot }), ...surface };
}

/** Fetch the lookout's bake into this shard's context (once). */
export async function loadFireLookout(ctx: ModelContext): Promise<void> {
  const bytes = await fetchBake(LOOKOUT_BAKE_URL);
  ctx.once(KEY, () => bytes);
}

const tower = timberFacts<Record<string, never>>((ctx) => {
  const bytes = ctx.once<Uint8Array>(KEY, () => { throw new Error('[fire-lookout] loadFireLookout(ctx) first'); });
  const { parts, glass } = lookoutParts(bytes, LOOKOUT_ROWS);
  const anchors = Object.fromEntries(Object.entries(LOOKOUT_ROWS.anchors).map(([k, p]) => [k, new THREE.Vector3(...p)]));
  const t = Timber.baked(LOOKOUT_NAME, parts, glass, { colliders: LOOKOUT_ROWS.colliders.map(colliderOf), floors: LOOKOUT_ROWS.floors, anchors });
  t.finish(timberMats(ctx), 6); // its detail distance from the tower's foot less 6 m (its size)
  return t;
});

export const fireLookout = defineModel<Record<string, never>>({
  id: 'pine-hollow/fire-lookout', name: 'Fire lookout', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/fireLookout.ts', surface: 'wood',
  defaults: {},
  build: (ctx, p) => tower.build(ctx, p),
  colliders: (p, ctx) => tower.facts(ctx, p).colliders,
});

/** its deck floors and its anchors (`zipTop`: the cable's end, `launch`: where you stand to ride), own space */
export const fireLookoutFacts = tower.facts;
