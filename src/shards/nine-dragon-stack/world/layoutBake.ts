/**
 * Restore the offline layout into its unchanged native kits, facade, crowd and
 * placement owners. The admitted product carries small validated row JSON;
 * world scenes own the standard GLB source geometries.
 */
import { Box3, Color, Matrix4, Sphere, Vector3 } from 'three';
import type { LayoutProjection } from '../runtime/productSections.generated';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import type { Ctx } from './ctx';

/** Each layout geometry is a mutable resource owned by the existing scene host. Its bounds are the offline bake's
 *  (generators/bake-layout-bounds.mjs, O19): assigned, never scanned at entry (30-40 ms Simulator tasks each). */
export function prepareLayout(rows: LayoutProjection, scenes: SceneHandles): void {
  for (const row of rows.geometries) {
    const geometry = scenes.geometry(`layout.${row.id}`), [x, y, z, radius] = row.sphere, box = row.bounds;
    geometry.boundingSphere = new Sphere(new Vector3(x, y, z), radius);
    geometry.boundingBox = box === undefined ? null : new Box3(new Vector3(box[0], box[1], box[2]), new Vector3(box[3], box[4], box[5]));
  }
}

/** Read exact author rows; native partition admission and ownership stay on world scenes. */
export async function loadLayoutBake(): Promise<LayoutProjection> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/layout-projection.json');
  return JSON.parse(new TextDecoder().decode(bytes), layoutReviver) as LayoutProjection;
}

/** The layout the page still builds from: its kits, their draw distances and drawn-in copies, the lanterns, the wall kit,
 *  the air conditioners, the grapple hooks and the facade shell (the rest of the bake's records are generators' inputs). */
export function restoreLayout(r: LayoutProjection, scenes: SceneHandles): Ctx {
  const ctx: Ctx = { kits: new Map(), alphaKits: new Map(), farOf: new Map(), lanterns: [], acs: [], hooks: [], hookMounts: [], inKit: [], inst: new Map(), shell: null };
  const geometry = (id: number) => scenes.geometry(`layout.${id}`);
  for (const [name, geo] of r.kits) ctx.kits.set(name, geo === null ? null : geometry(geo));
  for (const [name, geo] of r.alphaKits) ctx.alphaKits.set(name, geometry(geo));
  for (const [name, distance] of r.farOf) ctx.farOf.set(name, distance);
  ctx.lanterns.push(...r.lanterns.map(row => new Matrix4().fromArray(row)));
  ctx.acs.push(...r.acs.map(row => new Matrix4().fromArray(row)));
  ctx.hooks.push(...r.hooks.map(row => new Vector3(...row)));
  ctx.hookMounts.push(...r.hookMounts.map(row => ({ ring: new Vector3(...row.ring), out: new Vector3(...row.out) })));
  for (const [key, copies] of r.inst) ctx.inst.set(key, copies.map(row => ({ m: new Matrix4().fromArray(row.matrix), c: new Color(...row.color) })));
  if (r.shell !== null) ctx.shell = geometry(r.shell);
  for (const k of r.inKit) {
    const b = k.box;
    ctx.inKit.push({ model: k.model, kit: k.kit, at: k.at, ...(b === null ? {} : { box: new Box3(new Vector3(b[0], b[1], b[2]), new Vector3(b[3], b[4], b[5])) }) });
  }
  return ctx;
}

/** JSON keeps every double exactly but -0 and the non-finite: the bake writes those as strings (../generators/layout.ts) */
export function layoutReviver(_key: string, value: unknown): unknown {
  if (value === '-0') return -0;
  if (value === 'Infinity') return Number.POSITIVE_INFINITY;
  if (value === '-Infinity') return Number.NEGATIVE_INFINITY;
  return value;
}

