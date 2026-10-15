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
 * (`buildingSpecimen`). The kit's shared shapes (`logGeo`, `boxUV`) live in ../world/logKit.ts.
 */
import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { defineModel, type ModelBuild, type ModelContext } from '@wildshard/engine/models/model';
import { UnitParts, nearProxy, type WeldBuild } from '@wildshard/engine/models/weld';
import type { Cabins } from '../world/homestead';
import { CABIN_ROWS, LogBuilding, NO_OWNER } from '../world/cabinBake';
import { PROP_KINDS } from '../world/logKit';

/** one (geometry, material, world matrix) part of a flattened glTF prop */
export interface PropPart { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4 }

// ───────────────────────────── the homestead, as its models read it ─────────────────────────────

const cabinsBySky = new WeakMap<ModelContext['sky'], Cabins>();

/** Bind the current homestead for its construction owner, independently of disposable model assets.
 * A returning home replaces the previous binding; its old owner cannot remove the replacement. */
export function useCabins(ctx: ModelContext, cabins: Cabins, owner: Scope): void {
  if (owner.disposed) throw new Error('Cabins require a live construction owner');
  const sky = ctx.sky;
  cabinsBySky.set(sky, cabins);
  owner.onDispose(() => { if (cabinsBySky.get(sky) === cabins) cabinsBySky.delete(sky); });
}

/** Read the live homestead; resource-cache eviction never removes a construction service. */
export function cabinsOf(ctx: ModelContext): Cabins {
  const cabins = cabinsBySky.get(ctx.sky);
  if (cabins === undefined) throw new Error('[cabins] not built (useCabins)');
  return cabins;
}

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
