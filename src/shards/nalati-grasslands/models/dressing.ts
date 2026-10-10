/**
 * The Nalati dressing's scatter models (E306 / E315 second pass; the shapes were src/world/nalati/dressing/models.ts, the
 * generated rocks' fitting src/shards/nalati-grasslands/world/dressing/index.ts): every small thing the shard repeats between the places,
 * by the thousand — boulders, outcrop slabs and fieldstones; junipers, wild rose, dwarf willow; sage / lupin and
 * edelweiss / buttercup drifts; reeds. Their shapes are built offline (SHARD-PLATFORM M3, the places bake:
 * generators/dressingGeos.ts → public/assets/nalati/baked/dressing.bin + data/dressingGeos.json) and read back here
 * (world/placeBake.ts bakedDressingGeo), each standing on its local origin (y = 0 is the ground) at roughly unit size; the
 * placer scales them. The boulders and slabs that ship are the Hunyuan3D-2 rocks (`boulder-1/2/3.glb`) fitted into
 * the procedural rocks' frames, so the same plan, sizes and tints hold either way.
 *
 * Drawn by the dressing's scatter layers (src/shards/nalati-grasslands/world/dressing/: one InstancedMesh per kind on the shared painterly
 * material, culled per instance with per-instance draw distances) and placed `drawnInto` them; a big boulder or slab
 * collides as the hull of what its layer draws for it (the dressing's). Plants are walk-through.
 */
import * as THREE from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { defineModel, type ModelBuild, type ModelContext } from '@wildshard/engine/models/model';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import { loadNalatiModel, type NalatiModel } from '../world/glbPaint';
import { bakedDressingGeo, loadNalatiDressing } from '../world/placeBake';
import { modelReady } from '../world/painted';

// ── the generated rocks ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * A generated rock GLB fitted into a procedural rock's frame (centred on the origin, half-extents `half`: the placers
 * bury the bottom), so it drops into the same scatter plan with the same sizes. The model's own painterly material
 * (its atlas as the map) stays; the instances' rock tints multiply it.
 */
export function fitRock(m: NalatiModel, half: readonly [number, number, number]): THREE.BufferGeometry {
  const g = m.geometry.clone();
  const b = m.box, ctr = new THREE.Vector3(), sz = new THREE.Vector3();
  b.getCenter(ctr); b.getSize(sz);
  g.translate(-ctr.x, -ctr.y, -ctr.z);
  g.scale((half[0] * 2) / sz.x, (half[1] * 2) / sz.y, (half[2] * 2) / sz.z);
  g.computeVertexNormals();
  return g;
}

/** each generated rock's file and the procedural frame it is fitted into */
export const GENERATED_ROCK = {
  round: { name: 'boulder-1', half: [1, 0.74, 1] },
  tall: { name: 'boulder-2', half: [0.9, 0.95, 0.9] },
  slab: { name: 'boulder-3', half: [1.45, 0.5, 0.95] },
} as const;

/** the rocks' look on a generated file (its atlas, the painterly light) */
export const ROCK_LOOK = { rim: 0.3, bands: 0.8 } as const;

const PHONE = TIER === 'phone';
const FILE = 'src/shards/nalati-grasslands/generators/dressingGeos.ts';

/** the dressing's four painterly materials (one each for the shard: every layer of a kind shares it) */
export function dressMaterial(ctx: ModelContext, kind: 'rock' | 'shrub' | 'flower' | 'reed'): THREE.MeshLambertMaterial {
  return ctx.once(`nalati-dress-${kind}`, () => painterlyMaterial(ctx.sky, kind === 'rock' ? { rim: 0.3, bands: 0.8 } : kind === 'shrub' ? { rim: 0.5, bands: 0.7, sway: 0.05 } : kind === 'flower' ? { rim: 0.45, bands: 0.6, sway: 0.3 } : { rim: 0.5, bands: 0.6, sway: 0.1 }));
}

/** a generated rock's specimen: the fitted file, filled in when it lands */
function generatedRock(ctx: ModelContext, which: keyof typeof GENERATED_ROCK, id: string): THREE.Object3D {
  const g = new THREE.Group();
  const r = GENERATED_ROCK[which];
  loadNalatiModel(ctx.sky, r.name, ROCK_LOOK).then((m) => {
    const mesh = new THREE.Mesh(fitRock(m, r.half), m.material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id } }));
    return m;
  }).catch((e: unknown) => { console.warn(`[nalati] rock model ${r.name} failed`, e); });
  return g;
}

/** a dressing shape the page draws, by its bake key; a page fault (throws) before the places bake is in */
export function dressingGeo(key: string): THREE.BufferGeometry {
  const g = bakedDressingGeo(key);
  if (g === null) throw new Error(`[nalati-grasslands] the dressing shape '${key}' was asked for before its bake loaded`);
  return g;
}

/** a scatter model's specimen: its baked shape, or (the Explorer, before the bake is in) a group filled when it lands */
function specimen(id: string, key: string, material: THREE.Material, castShadow = true): ModelBuild {
  const geometry = bakedDressingGeo(key);
  if (geometry !== null) return [{ geometry, material, castShadow, receiveShadow: true }];
  const g = new THREE.Group();
  void (async (): Promise<void> => {
    await loadNalatiDressing();
    const later = bakedDressingGeo(key);
    if (later === null) return;
    const mesh = new THREE.Mesh(later, material);
    mesh.castShadow = castShadow; mesh.receiveShadow = true;
    g.add(mesh);
    modelReady(id);
  })();
  return g;
}

export interface RockParams {
  /** the generated (Hunyuan3D-2) rock that ships, or the procedural one */
  readonly source: 'generated' | 'code';
  /** the tall faceted boulder (every third boulder of the plan) */
  readonly tall: boolean;
}

export const boulder = defineModel<RockParams>({
  id: 'nalati-grasslands/boulder', name: 'Boulder', category: 'nature', pipeline: ['hunyuan', 'code'], file: FILE, surface: 'rock',
  defaults: { source: 'generated', tall: false },
  variants: [
    { id: 'round', label: 'Hunyuan3D-2', params: {} },
    { id: 'tall', label: 'Hunyuan3D-2 · tall', params: { tall: true } },
    { id: 'code', label: 'Code', params: { source: 'code' } },
  ],
  build: (ctx, p) => (p.source === 'code' ? specimen('nalati-grasslands/boulder', `boulder:${PHONE ? 2 : 3}`, dressMaterial(ctx, 'rock')) : generatedRock(ctx, p.tall ? 'tall' : 'round', 'nalati-grasslands/boulder')),
});

export const slab = defineModel<RockParams>({
  id: 'nalati-grasslands/slab', name: 'Outcrop slab', category: 'nature', pipeline: ['hunyuan', 'code'], file: FILE, surface: 'rock',
  defaults: { source: 'generated', tall: false },
  variants: [{ id: 'generated', label: 'Hunyuan3D-2', params: {} }, { id: 'code', label: 'Code', params: { source: 'code' } }],
  build: (ctx, p) => (p.source === 'code' ? specimen('nalati-grasslands/slab', `slab:${PHONE ? 2 : 3}`, dressMaterial(ctx, 'rock')) : generatedRock(ctx, 'slab', 'nalati-grasslands/slab')),
});

export const stone = defineModel<object>({
  id: 'nalati-grasslands/stone', name: 'Fieldstone / cobble', category: 'nature', pipeline: 'code', file: FILE, surface: 'stone',
  defaults: {}, build: (ctx) => specimen('nalati-grasslands/stone', 'stone', dressMaterial(ctx, 'rock'), false),
});

export const juniper = defineModel<object>({
  id: 'nalati-grasslands/juniper', name: 'Juniper', category: 'nature', pipeline: 'code', file: FILE,
  defaults: {}, build: (ctx) => specimen('nalati-grasslands/juniper', 'juniper', dressMaterial(ctx, 'shrub'), !PHONE),
});

export const wildRose = defineModel<object>({
  id: 'nalati-grasslands/wild-rose', name: 'Wild rose', category: 'nature', pipeline: 'code', file: FILE,
  defaults: {}, build: (ctx) => specimen('nalati-grasslands/wild-rose', PHONE ? 'rose:lite' : 'rose', dressMaterial(ctx, 'shrub'), !PHONE),
});

export const dwarfWillow = defineModel<object>({
  id: 'nalati-grasslands/dwarf-willow', name: 'Dwarf willow', category: 'nature', pipeline: 'code', file: FILE,
  defaults: {}, build: (ctx) => specimen('nalati-grasslands/dwarf-willow', 'willow', dressMaterial(ctx, 'shrub'), !PHONE),
});

export const lupin = defineModel<object>({
  id: 'nalati-grasslands/lupin', name: 'Sage / lupin drift', category: 'nature', pipeline: 'code', file: FILE,
  defaults: {}, build: (ctx) => specimen('nalati-grasslands/lupin', PHONE ? 'lupin:lite' : 'lupin', dressMaterial(ctx, 'flower'), false),
});

export const daisy = defineModel<object>({
  id: 'nalati-grasslands/daisy', name: 'Edelweiss / buttercup drift', category: 'nature', pipeline: 'code', file: FILE,
  defaults: {}, build: (ctx) => specimen('nalati-grasslands/daisy', 'daisy', dressMaterial(ctx, 'flower'), false),
});

export const reeds = defineModel<object>({
  id: 'nalati-grasslands/reed', name: 'Reeds', category: 'nature', pipeline: 'code', file: FILE,
  defaults: {}, build: (ctx) => specimen('nalati-grasslands/reed', 'reed', dressMaterial(ctx, 'reed'), false),
});
