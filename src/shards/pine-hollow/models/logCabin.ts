/**
 * The log cabin (E315 M2; PINE-HOLLOW-REMASTER): the Hollow's three, one variant each — the ranger's cabin in the Hollow,
 * the east cabin, the ridge cabin — as models, and the hamlet's five (./huntingLodge.ts, ./traderStall.ts,
 * ./millersHouse.ts, ./watermill.ts, ./hamletShed.ts) through the same two calls.
 *
 * G285: every log building is an offline bake (../generators/logCabin.ts builds it where it stands, the page assembles the
 * record, ../world/cabinBake.ts). The homestead (../world/homestead.ts `Cabins.build`) assembles each building; `place`
 * draws it (`ModelDef.weld`, src/engine/models/weld.ts): the cabins' parts merged per building and their never-hidden
 * materials welded across the three, the hamlet's five welded into one set, the detail and far sets dropped with distance
 * (../world/cabins.ts). The Explorer's specimen is the building assembled alone and merged as the world merges a cabin
 * (`buildingSpecimen`). The kit's shared shapes (`logGeo`, `boxUV`) live in ../world/logKit.ts; `finishParts` and
 * `mergeParts` stay here for the landmarks' timber and the props.
 */
import * as THREE from 'three';
import { defineModel, type ModelBuild, type ModelContext } from '@wildshard/engine/models/model';
import { UnitParts, mergeOrNull, nearProxy, type WeldBuild } from '@wildshard/engine/models/weld';
import type { Cabins, Mats, MatKey } from '../world/homestead';
import { CABIN_ROWS, DETAIL_KEYS, FAR_KEYS, LogBuilding, NO_OWNER } from '../world/cabinBake';
import { PROP_KINDS } from '../world/logKit';

/** one (geometry, material, world matrix) part of a flattened glTF prop */
export interface PropPart { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }

/**
 * Merge a timber's parts per material under `root` (src/shards/pine-hollow/world/timber.ts: the landmarks, drawn `single`):
 * one mesh per material, the small hardware in `detailList` (it casts its own shadow), the mid parts in `farList`, and the
 * static shadow casters as two position-only proxies (the silhouette set, and the far set that goes with the far list).
 */
export function finishParts(parts: Map<MatKey, THREE.BufferGeometry[]>, mats: Mats, root: THREE.Object3D, detailList: THREE.Object3D[], farList: THREE.Object3D[]): void {
  // (the bands are markers here: the timber tags its lists with its own distances)
  const DETAIL = 1, FAR = 2;
  const unit = new UnitParts();
  for (const [key, geometries] of parts) {
    const material = mats[key];
    if (DETAIL_KEYS.has(key)) unit.add([{ material, geometries, until: DETAIL, depth: 'near', receiveShadow: true, castShadow: true }]);
    else if (FAR_KEYS.has(key)) unit.add([{ material, geometries, until: FAR, depth: 'proxy', receiveShadow: true }]);
    else unit.add([{ material, geometries, depth: 'proxy', receiveShadow: true }]);
  }
  parts.clear();
  const drawn = unit.draw(root, false);
  for (const { mesh, part } of drawn.meshes) {
    if (part.until === DETAIL) detailList.push(mesh);
    else if (part.until === FAR) farList.push(mesh);
  }
  for (const { mesh, until } of drawn.proxies) if (until === FAR) farList.push(mesh);
}

/**
 * Collapse the parts that share a material into one part (their matrices baked into the geometry) — the same pixels, one
 * draw instead of one per glTF mesh. Parts whose attributes do not line up for a merge stay as they are.
 */
export function mergeParts(parts: PropPart[]): PropPart[] {
  const byMat = new Map<THREE.Material, PropPart[]>();
  for (const p of parts) { const l = byMat.get(p.material); if (l === undefined) byMat.set(p.material, [p]); else l.push(p); }
  const out: PropPart[] = [];
  for (const [material, list] of byMat) {
    const first = list[0];
    if (list.length === 1 && first !== undefined) { out.push(first); continue; }
    const merged = mergeOrNull(list.map((p) => p.geometry.clone().applyMatrix4(p.matrix)));
    if (merged === null) { out.push(...list); continue; }
    merged.computeBoundingSphere();
    out.push({ geometry: merged, material, matrix: new THREE.Matrix4() });
  }
  return out;
}

// ───────────────────────────── the homestead, as its models read it ─────────────────────────────

const KEY = 'pine-hollow/cabins';

/** hand the built homestead to its models (src/shards/pine-hollow/world/cabins.ts) */
export function useCabins(ctx: ModelContext, cabins: Cabins): void { ctx.once(KEY, () => cabins); }

/** the homestead handed to this shard's models */
export const cabinsOf = (ctx: ModelContext): Cabins => ctx.once<Cabins>(KEY, () => { throw new Error('[cabins] not built (useCabins)'); });

/** building `id` (`cabin-1` … or a hamlet building's) as the homestead built it where it stands: its `place` weld build */
export function builtBuilding(ctx: ModelContext, id: string): WeldBuild {
  const b = cabinsOf(ctx).buildings.find((x) => x.id === id);
  if (b === undefined) throw new Error(`[cabins] no building '${id}'`);
  return b.weld;
}

/**
 * Building `id` alone, in its own frame, for the Model Explorer (E315 M2): built where it stands (its site-fitted parts:
 * the mill's stilts) with its lights as anchors, its parts merged as the world merges a cabin's (its near proxy on a tier
 * with one), then set at the origin; its props drawn with it. An empty group before the homestead is built.
 */
export function buildingSpecimen(ctx: ModelContext, id: string): ModelBuild {
  const cabins = cabinsOf(ctx), b = cabins.buildings.find((x) => x.id === id), kit = cabins.kit, row = CABIN_ROWS.buildings.find((r) => r.id === id);
  if (b === undefined || kit === null || row === undefined) return new THREE.Group();
  const cb = new LogBuilding(NO_OWNER, row, kit.geometries, kit.mats, ctx.sky, kit, 'specimen');
  const props = cb.props;
  const unit = new UnitParts();
  unit.add(cb.weldParts());
  const casters = cb.casters;
  const drawn = unit.draw(cb.root, casters !== null);
  const np = casters === null ? null : nearProxy(drawn.front, casters);
  if (np !== null) cb.root.add(np);
  const toLocal = cb.root.matrixWorld.clone().invert();
  cb.root.position.set(0, 0, 0); cb.root.rotation.set(0, 0, 0);
  cb.root.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  for (const k of PROP_KINDS) for (const part of kit.props[k]) {
    const list = props[k];
    if (list.length === 0) continue;
    const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
    list.forEach((w, j) => { im.setMatrixAt(j, m.multiplyMatrices(toLocal, w).multiply(part.matrix)); });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true;
    cb.root.add(im);
  }
  return cb.root;
}

// ───────────────────────────── the log cabin ─────────────────────────────

export const CABIN_VARIANTS = ['hollow', 'east', 'ridge'] as const;

export interface LogCabinParams { readonly site: number }

export const logCabin = defineModel<LogCabinParams>({
  id: 'pine-hollow/log-cabin', name: 'Log cabin', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/logCabin.ts', surface: 'wood',
  defaults: { site: 0 },
  variants: [
    { id: 'hollow', label: "The ranger's (the Hollow)", params: { site: 0 } },
    { id: 'east', label: 'East', params: { site: 1 } },
    { id: 'ridge', label: 'Ridge', params: { site: 2 } },
  ],
  build: (ctx, p) => buildingSpecimen(ctx, `cabin-${p.site + 1}`),
  weld: (ctx, p) => builtBuilding(ctx, `cabin-${p.site + 1}`),
});
