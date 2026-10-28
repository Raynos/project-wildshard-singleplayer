import { MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { Rng } from '@wildshard/sdk/random';
import { WRECK, OCEAN } from './worldSites';
import foliagePolicy from '../data/foliagePolicy.json' with { type: 'json' };
import { SEED, WORLD_DROP } from './landscapeRows';
import { REEF_SPECIMENS, REEF_MODEL_SEED } from './reefSpecimenRows';
import { LAGOON_REEF, scatterLagoon, type LagoonField, type ReefLayout } from './reefScatter';
import { reefGeometry } from './reef';
import { driftwoodGroundBytes } from './groundRows';
import { foliageTransport } from './hibiscusTransport';
import publicInputs from '../data/publicInputs.json' with { type: 'json' };

/** One reef blob: its product name's kind and bytes. */
export interface ReefBlob { readonly kind: 'glb' | 'bin'; readonly bytes: Uint8Array }
/** The lagoon's reef (GR7: the `driftwood-reef` job's layout, blobs and hash-named public copies): the scatter layout
 *  (world/Seabed and the fish school read it), the welded world batch and each kind's Explorer cards by product name,
 *  and the job's public URLs (reefFiles.ts's `REEF_FILES`) as aliases of those names. */
export interface DriftwoodReefBank {
  readonly layout: ReefLayout;
  /** equal payloads keep the first name, as the job's writer kept them */
  readonly blobs: ReadonlyMap<string, ReefBlob>;
  readonly byUrl: Readonly<Record<string, string>>;
}

/** the job's hash-named public copies' folder (their URLs are the blobs' aliases) */
const BAKED = publicInputs.baked;
let bank: DriftwoodReefBank | undefined;
/** Built once per build process from the native ground (no file is read); every reader treats it as read-only. */
export function driftwoodReefBank(): DriftwoodReefBank { bank ??= buildReefBank(); return bank; }

function buildReefBank(): DriftwoodReefBank {
  const native = readNativeTerrain(driftwoodGroundBytes());
  // the island's heights with its G164 datum, as the level's bound heightfield samples them; normals unshifted
  const field: LagoonField = { half: native.grid.size / 2, level: OCEAN.level, roadWidth: foliagePolicy.roadWidth, heightAt: (x, z) => native.heightAt(x, z) - WORLD_DROP, normalAt: (x, z, reach) => native.normalAt(x, z, reach) };
  const blobs = new Map<string, ReefBlob>(), byUrl: Record<string, string> = {}, names = new Map<string, string>();
  const emit = (bytes: Uint8Array, kind: ReefBlob['kind'], name: string): void => {
    const hash = hashImmutableBytes(bytes), owner = names.get(hash) ?? name;
    if (!names.has(hash)) { names.set(hash, name); blobs.set(name, { kind, bytes }); }
    byUrl[`${BAKED}reef-${hash}.${kind}`] = owner;
  };
  // The lagoon's layout (world/Seabed.ts reads it): 360 copies, the wreck kept clear, welded in scatter order from one stream.
  const layout = scatterLagoon(SEED, 360, [{ x: WRECK.x, z: WRECK.z, r: 18 }], field), rng = new Rng(LAGOON_REEF.buildSeed);
  const originals = layout.items.map(p => {
    if (p.kind !== 'coral' && p.kind !== 'weed' && p.kind !== 'star') throw new Error('Unknown authored reef kind');
    return reefGeometry(p.kind, { s: p.s, rot: p.rot, v: p.v }, rng).translate(p.x, field.heightAt(p.x, p.z), p.z);
  });
  const geometry = mergeGeometries(originals, false), vertices = geometry.getAttribute('position').count;
  try { emit(foliageTransport(geometry, originals, { vertices, indices: 0, output: vertices, runs: [{ start: 0, count: vertices }] }, 0x31464552, ['position', 'color', 'aSway']), 'bin', 'world/reef.bin'); }
  finally { geometry.dispose(); for (const shape of originals) shape.dispose(); }
  // Explorer cards: each authored default and variant, from the model's own seed, loaded only when selected.
  for (const kind of ['coral', 'weed', 'star'] as const) {
    const row = REEF_SPECIMENS[kind];
    for (const variant of [{ id: 'default', params: row.defaults }, ...row.variants.map(v => ({ id: v.id, params: { ...row.defaults, ...v.params } }))]) {
      const shape = reefGeometry(kind, variant.params, new Rng(REEF_MODEL_SEED)), material = new MeshStandardMaterial();
      try { emit(staticGlb([{ geometry: shape, material, customAttributes: { _SWAY: 'aSway' }, compactIndex: true }], `reef-${kind}`), 'glb', `models/reef/${kind}/${variant.id}.glb`); }
      finally { shape.dispose(); material.dispose(); }
    }
  }
  return { layout, blobs, byUrl };
}
