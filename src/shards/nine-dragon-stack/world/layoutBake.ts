/**
 * Restore the offline layout into its unchanged native kits, facade, crowd and
 * placement owners. The admitted product carries small validated row JSON;
 * world scenes own the standard GLB source geometries.
 */
import { Box3, Sphere, Vector3 } from 'three';
import type { LayoutProjection } from '../runtime/productSections.generated';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import type { Ctx } from './ctx';

/** Each layout geometry is a mutable resource owned by the existing scene host. Its bounds are the offline bake's
 *  (generators/bake-layout-bounds.mjs, O19): assigned, never scanned at entry (30-40 ms Simulator tasks each). */
export function prepareLayout(rows: LayoutProjection, scenes: SceneHandles): void {
  for (const row of rows.geometries) {
    const geometry = scenes.geometry(`layout.${row.id}`), [x0, y0, z0, x1, y1, z1, radius] = row.s;
    const box = new Box3(new Vector3(Math.fround(x0), Math.fround(y0), Math.fround(z0)), new Vector3(Math.fround(x1), Math.fround(y1), Math.fround(z1)));
    geometry.boundingSphere = new Sphere(box.getCenter(new Vector3()), radius);
    geometry.boundingBox = row.box ? box : null;
  }
}

/** Read exact author rows; native partition admission and ownership stay on world scenes. */
export async function loadLayoutBake(): Promise<LayoutProjection> {
  const bytes = await (await loadFirstPartyProduct('nine-dragon-stack')).file('geometry/layout-projection.json');
  return JSON.parse(new TextDecoder().decode(bytes), layoutReviver) as LayoutProjection;
}

/** The layout the page still builds from: its kits, their draw distances and drawn-in copies, the grapple hooks and the
 *  facade shell. The lanterns, air conditioners and wall kit are world-scene placements; the rest of the bake's
 *  records are generators' inputs. */
export function restoreLayout(r: LayoutProjection, scenes: SceneHandles): Ctx {
  const ctx: Ctx = { kits: new Map(), alphaKits: new Map(), farOf: new Map(), hooks: [], hookMounts: [], inKit: [], shell: null };
  const geometry = (id: number) => scenes.geometry(`layout.${id}`);
  for (const [name, geo] of r.kits) ctx.kits.set(name, geo === null ? null : geometry(geo));
  for (const [name, geo] of r.alphaKits) ctx.alphaKits.set(name, geometry(geo));
  for (const [name, distance] of r.farOf) ctx.farOf.set(name, distance);
  ctx.hooks.push(...r.hooks.map(row => new Vector3(...row)));
  ctx.hookMounts.push(...r.hookMounts.map(row => ({ ring: new Vector3(...row.ring), out: new Vector3(...row.out) })));
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

