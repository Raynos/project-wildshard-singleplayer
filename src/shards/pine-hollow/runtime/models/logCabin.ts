/**
 * Pine Hollow's log buildings as rows (E315 M2; PINE-HOLLOW-REMASTER PH-B3 / C6, G465): the Hollow's three cabins, one
 * variant each — the ranger's cabin in the Hollow, the east cabin, the ridge cabin — and the mill hamlet's five buildings
 * (the lodge, the trader's stall, the miller's house, the watermill, the shed), one model each, through the same two calls.
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
import { defineModel, type ModelBuild, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import { UnitParts, nearProxy, type WeldBuild } from '@wildshard/engine/models/weld';
import type { Cabins } from '../world/homestead';
import { CABIN_ROWS, LogBuilding, NO_OWNER } from '../world/cabinBake';
import { PROP_KINDS } from '../../world/logKit';

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

/** the specimen's prop loop caps: the four cabin props (../world/logKit PROP_KINDS) and a scan's few meshes each */
const MAX_PROP_KINDS = 4, MAX_PROP_PARTS = 16;

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
  if (PROP_KINDS.length > MAX_PROP_KINDS) throw new Error('[cabins] more prop kinds than the specimen draws');
  for (let i = 0; i < Math.min(PROP_KINDS.length, MAX_PROP_KINDS); i++) {
    const k = PROP_KINDS[i];
    if (k === undefined) continue;
    const list = props[k], parts = kit.props[k];
    if (list.length === 0) continue;
    if (parts.length > MAX_PROP_PARTS) throw new Error(`[cabins] the ${k} scan has more meshes than the specimen draws`);
    for (let p = 0; p < Math.min(parts.length, MAX_PROP_PARTS); p++) {
      const part = parts[p];
      if (part === undefined) continue;
      const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      list.forEach((w, j) => { im.setMatrixAt(j, m.multiplyMatrices(toLocal, w).multiply(part.matrix)); });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true;
      cb.root.add(im);
    }
  }
  return cb.root;
}

// ───────────────────────────── the buildings as rows ─────────────────────────────

/** a row with variants is the cabins (bake ids `cabin-<site + 1>`); one without is a hamlet building (its bake id) */
const ROWS: readonly { readonly id: string; readonly name: string; readonly variants?: readonly (readonly [string, string])[] }[] = [
  { id: 'log-cabin', name: 'Log cabin', variants: [['hollow', "The ranger's (the Hollow)"], ['east', 'East'], ['ridge', 'Ridge']] },
  { id: 'hunting-lodge', name: 'Hunting lodge' }, { id: 'trader-stall', name: "Trader's stall" },
  { id: 'millers-house', name: "Miller's house" }, { id: 'watermill', name: 'Watermill' }, { id: 'hamlet-shed', name: 'Hamlet shed' },
];

export interface LogCabinParams { readonly site: number }
type Building = ModelDef<LogCabinParams>;

/** Every log building's model by its row id: `place` welds the hamlet's five into one set, dropped with distance. */
export const HAMLET_MODELS: Readonly<Record<string, Building>> = Object.fromEntries(ROWS.map((r) => {
  const bakeId = (site: number): string => (r.variants ? `cabin-${site + 1}` : r.id);
  return [r.id, defineModel<LogCabinParams>({
    id: `pine-hollow/${r.id}`, name: r.name, category: 'buildings', pipeline: 'code', file: 'src/shards/pine-hollow/runtime/models/logCabin.ts', surface: 'wood', defaults: { site: 0 },
    ...(r.variants ? { variants: r.variants.map(([id, label], site) => ({ id, label, params: { site } })) } : {}),
    build: (ctx, p) => buildingSpecimen(ctx, bakeId(p.site)), weld: (ctx, p) => builtBuilding(ctx, bakeId(p.site)),
  })];
}));
const cabin = HAMLET_MODELS['log-cabin'];
if (cabin === undefined) throw new Error('[cabins] no log-cabin row');
export const logCabin: Building = cabin;
/** the cabins' variant ids by site */
export const CABIN_VARIANTS: readonly string[] = ROWS[0]?.variants?.map(([id]) => id) ?? [];
