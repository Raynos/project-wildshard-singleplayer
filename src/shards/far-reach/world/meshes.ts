import MILL_REST from '../data/millRest.generated.json' with { type:'json' };
import { ISLET_POOL } from '../data/restFiles';
import { loadRigFile } from '@wildshard/engine/anim/rig';
import { cacheUntilDisposed, retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { releaseDecodedOnUpload } from '../look/image';
import { SKY_RIG_LIBRARY } from '../data/rigLibrary';
import { SKY_HD, SKY_MESHES, HD_URLS, MODEL_URLS, FAN_POOL, type SkyHdName, type SkyMeshName } from '../data/files';
import REST_POOLS from '../data/restPools.generated.json' with { type: 'json' };
import BRIDGES from '../data/bridgeRest.generated.json' with { type: 'json' };
import { SKY_AO_FLOOR, PREPARED_MODELS_URL } from '../data/modelFrames';
import { createModelLibrary } from '@wildshard/sdk/looks/modelLibrary';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Sphere, Vector3, type Texture, type Object3D } from 'three';

/**
 * Sky Reach's generated models (C6, E374): codex refs → Hunyuan3D-2 → faceted, vertex-coloured GLBs
 * (`art/far-reach/round-7-models/props.json`, built into `public/assets/far-reach/models/<name>/<name>.glb`). Each is
 * loaded once behind the loading screen (`preloadSkyMeshes`, the plugin's `world` hook) and kept as one flat
 * non-indexed geometry: position, the facet colour (rgb × the baked AO in COLOR_0's alpha) and flat normals. A model
 * that fails to load leaves its code model in place.
 */

let loading: Promise<void> | null = null;
/** The facet models, through the SDK model library (its facet intake is the bakes' `generators/modelIntake.ts`). */
export const SKY_LIBRARY = createModelLibrary<SkyMeshName, never>({ meshes: SKY_MESHES, preparedMeshes: SKY_MESHES, meshUrls: MODEL_URLS, hd: [], hdUrls: {}, aoFloor: SKY_AO_FLOOR, hdLooks: {}, geometryPools: [FAN_POOL,...REST_POOLS, BRIDGES.pool, ISLET_POOL, MILL_REST], rigs: SKY_RIG_LIBRARY, rigLoad: 'manual' }, '[far-reach]');

/** A textured hero model: one indexed geometry (float position, normal, uv in the file's frame) and its painted map. */
export interface SkyHd { readonly geometry: BufferGeometry; readonly map: Texture; readonly pivots?: { readonly body: BufferGeometry; readonly head: BufferGeometry; readonly arm: BufferGeometry; readonly fore: BufferGeometry } }
const hd = new Map<SkyHdName, SkyHd>();
const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;
async function loadHd(name: SkyHdName, geometry: BufferGeometry, pivots?: SkyHd['pivots']): Promise<void> {
  try {
    const gltf = await loadRigFile(HD_URLS[name]);
    const maps: Texture[] = [];
    gltf.scene.traverse(node => {
      if (maps.length > 0 || !isMesh(node)) return;
      const material = Array.isArray(node.material) ? node.material[0] : node.material;
      if (material instanceof MeshStandardMaterial && material.map !== null && node.geometry.hasAttribute('uv') && node.geometry.getIndex() !== null) maps.push(material.map);
    });
    const map = maps[0], one: SkyHd | undefined = map === undefined ? undefined : { geometry, map, ...(pivots === undefined ? {} : { pivots }) };
    if (one === undefined) throw new Error(`${name}: no textured mesh`);
    // Memory saver: the GLB's decoded atlas goes at its upload. Sky Reach never reads these maps on the CPU, every user
    // shares this one texture (no other sampler key), and the GLB is parsed afresh per visit (no cache keeps the source).
    const atlas: unknown = one.map.image;
    if (typeof ImageBitmap !== 'undefined' && atlas instanceof ImageBitmap) releaseDecodedOnUpload(one.map, () => { atlas.close(); });
    retainCachedResources(one); hd.set(name, one);
    cacheUntilDisposed(one, () => { if (hd.get(name) === one) { hd.delete(name); loading = null; } });
  } catch (e: unknown) { console.warn(`[far-reach] ${name} not loaded, the faceted model stands in:`, e); }
}

/** Restore the native tight bounds of an authored primitive instead of the loader's box diagonal. */
function preparedGeometry(scene: Object3D, name: string): BufferGeometry {
  const node = scene.getObjectByName(name);
  if (node === undefined || !isMesh(node)) throw new Error(`far-reach: missing prepared model ${name}`);
  // GLTFLoader otherwise uses the box diagonal, widening frustum admission versus the native fitted sphere.
  const bounds: unknown = Reflect.get(node.userData, 'sphere');
  if (!Array.isArray(bounds) || bounds.length !== 4) throw new Error(`far-reach: missing prepared bounds ${name}`);
  const x: unknown = bounds[0], y: unknown = bounds[1], z: unknown = bounds[2], radius: unknown = bounds[3];
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || typeof radius !== 'number'
    || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) throw new Error(`far-reach: invalid prepared bounds ${name}`);
  node.geometry.boundingSphere = new Sphere(new Vector3(x, y, z), radius);
  return node.geometry;
}

/** Declared zero-sized pivots stay empty; a missing nonempty primitive is a damaged product, never a fallback fit. */
function preparedKeeper(scene: Object3D): NonNullable<SkyHd['pivots']> {
  const node = scene.getObjectByName('keeper-hd');
  const counts: unknown = node?.userData['npcCounts'];
  if (!Array.isArray(counts) || counts.length !== 4) throw new Error('Missing keeper pivot counts');
  const part = (index: number): BufferGeometry => {
    const count: unknown = counts[index];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 500_000) throw new Error('Invalid keeper pivot count');
    if (count === 0) {
      const geometry = new BufferGeometry();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) geometry.setAttribute(name, new Float32BufferAttribute([], size));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
    }
    const geometry = preparedGeometry(scene, `keeper-pivot-${String(index)}`);
    if (geometry.getAttribute('position').count !== count || geometry.index !== null) throw new Error('Keeper pivot channels differ from declaration');
    return geometry;
  };
  return { body: part(0), head: part(1), arm: part(2), fore: part(3) };
}

/** The author's plain accessors already contain the final static frame; no vertex processing runs on entry. */
async function loadPreparedModels(pause?: () => Promise<void>): Promise<void> {
  const missing = SKY_HD.filter(name => !hd.has(name));
  if (missing.length === 0) return;
  const prepared = await loadRigFile(PREPARED_MODELS_URL);
  const load = (name: SkyHdName): Promise<void> => {
    const geometry = preparedGeometry(prepared.scene, name);
    const pivots = name === 'keeper-hd' ? preparedKeeper(prepared.scene) : undefined;
    return loadHd(name, geometry, pivots);
  };
  if (pause === undefined) await Promise.all(missing.map(load));
  else for (const name of missing) { await load(name); await pause(); }
}

async function loadModels(pause?: () => Promise<void>): Promise<void> {
  try { await Promise.all([loadPreparedModels(pause), SKY_LIBRARY.preloadRigs()]); }
  catch (error) { loading = null; throw error; }
}

/** Load every generated model and baked creature body once (a failed one is skipped). */
export function preloadSkyMeshes(pause?: () => Promise<void>): Promise<void> {
  loading ??= loadModels(pause);
  return Promise.all([SKY_LIBRARY.preload(), loading]).then(() => undefined);
}

/** A textured hero model (a copy of its geometry, its shared map), or null (not loaded: use the faceted model). */
export function skyHd(name: SkyHdName): SkyHd | null { const m = hd.get(name); return m ? { geometry: m.geometry.clone(), map: m.map, ...(m.pivots === undefined ? {} : { pivots: { body: m.pivots.body.clone(), head: m.pivots.head.clone(), arm: m.pivots.arm.clone(), fore: m.pivots.fore.clone() } }) } : null; }

/** A hero model's matte painted material (no metal, soft roughness, smooth normals). */
export const hdMaterial = (map: Texture): MeshStandardMaterial => new MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });

/** A copy of a loaded model's geometry, or null (not loaded: use the code model). */
export const skyMesh = SKY_LIBRARY.mesh;
