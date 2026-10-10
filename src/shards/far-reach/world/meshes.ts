import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { releaseDecodedOnUpload } from '../look/image';
import { preloadSkyBodies } from '../species/bodies';
import { SKY_HD, SKY_MESHES, skyHdUrl, skyMeshUrl, type SkyHdName, type SkyMeshName } from '../boot/files';
import { facetedGeometry, hdGeometry } from '@wildshard/sdk/looks/modelIntake';
import { MeshStandardMaterial, type BufferGeometry, type Texture } from 'three';

/**
 * Sky Reach's generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs
 * (`art/far-reach/round-7-models/props.json`, built into `public/assets/far-reach/models/<name>/<name>.glb`). Each is
 * loaded once behind the loading screen (`preloadSkyMeshes`, the plugin's `world` hook) and kept as one flat
 * non-indexed geometry: position, the facet colour (rgb × the baked AO in COLOR_0's alpha) and flat normals. A model
 * that fails to load leaves its code model in place.
 */

const ready = new Map<SkyMeshName, BufferGeometry>();
/** How much of the baked AO survives: a facet in full occlusion keeps this share of its colour (the runtime intake and
 *  the offline creature bake, `generators/creatures.ts`, share it). */
export const SKY_AO_FLOOR = 0.6;
let loading: Promise<void> | null = null;

async function load(name: SkyMeshName): Promise<void> {
  try {
    const gltf = await loadRigFile(skyMeshUrl(name)), g = facetedGeometry(gltf.scene, SKY_AO_FLOOR);
    if (g === null) throw new Error(`${name}: no mesh`);
    retainCachedResources(g); ready.set(name, g);
    cacheUntilDisposed(g, () => { if (ready.get(name) === g) { ready.delete(name); loading = null; } });
  } catch (e: unknown) { console.warn(`[far-reach] ${name} not loaded, the code model stands in:`, e); }
}

/** A textured hero model: one indexed geometry (float position, normal, uv in the file's frame) and its painted map. */
export interface SkyHd { readonly geometry: BufferGeometry; readonly map: Texture }
const hd = new Map<SkyHdName, SkyHd>();
async function loadHd(name: SkyHdName): Promise<void> {
  try {
    const gltf = await loadRigFile(skyHdUrl(name)), model = hdGeometry(gltf.scene, (m) => m.map !== null), map = model?.material.map ?? null;
    const one: SkyHd | undefined = model === null || map === null ? undefined : { geometry: model.geometry, map };
    if (one === undefined) throw new Error(`${name}: no textured mesh`);
    // Memory saver: the GLB's decoded atlas goes at its upload. Sky Reach never reads these maps on the CPU, every user
    // shares this one texture (no other sampler key), and the GLB is parsed afresh per visit (no cache keeps the source).
    const atlas: unknown = one.map.image;
    if (typeof ImageBitmap !== 'undefined' && atlas instanceof ImageBitmap) releaseDecodedOnUpload(one.map, () => { atlas.close(); });
    retainCachedResources(one); hd.set(name, one);
    cacheUntilDisposed(one, () => { if (hd.get(name) === one) { hd.delete(name); loading = null; } });
  } catch (e: unknown) { console.warn(`[far-reach] ${name} not loaded, the faceted model stands in:`, e); }
}

/** Load every generated model and baked creature body once (a failed one is skipped). */
export function preloadSkyMeshes(): Promise<void> {
  loading ??= Promise.all([...SKY_MESHES.filter(name => !ready.has(name)).map(load), ...SKY_HD.filter(name => !hd.has(name)).map(loadHd), preloadSkyBodies()]).then(() => undefined);
  return loading;
}

/** A textured hero model (a copy of its geometry, its shared map), or null (not loaded: use the faceted model). */
export function skyHd(name: SkyHdName): SkyHd | null { const m = hd.get(name); return m ? { geometry: m.geometry.clone(), map: m.map } : null; }

/** A hero model's matte painted material (no metal, soft roughness, smooth normals). */
export const hdMaterial = (map: Texture): MeshStandardMaterial => new MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });

/** A copy of a loaded model's geometry, or null (not loaded: use the code model). */
export function skyMesh(name: SkyMeshName): BufferGeometry | null { return ready.get(name)?.clone() ?? null; }
