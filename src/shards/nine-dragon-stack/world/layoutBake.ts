/**
 * Restore the offline layout into its unchanged native kits, facade, crowd and
 * placement owners. The admitted product carries small validated row JSON and
 * exact float64 records separately from its standard GLB source geometries.
 */
import { Box3, type BufferGeometry, Color, Matrix4, Vector3 } from 'three';
import type { LayoutProjection, GeometryBoot } from '../runtime/productSections.generated';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Ctx } from './ctx';

/** Standard GLB layout geometries and plain double-precision author rows. */
export class LayoutBake {
  constructor(readonly rows: LayoutProjection, private readonly geometries: Map<number, BufferGeometry>) {}
  /** copies `prepare` made ahead, each handed out once by `geometry` */
  private readonly ahead = new Map<number, BufferGeometry>();
  geometry(i: number): BufferGeometry {
    const ready = this.ahead.get(i);
    if (ready !== undefined) { this.ahead.delete(i); return ready; }
    return this.copy(i);
  }
  /** Make every copy `restoreLayout` takes ahead of it, with `pause` between copies: the same copies, made earlier. In
   *  one synchronous restore the copies and their bounds (1.16 M vertices) were a single ~150 ms iOS Simulator frame
   *  when a grid cell builds Nine on the road (sp-o101). */
  async prepare(pause: () => Promise<void>): Promise<void> {
    for (const { id: i } of this.rows.geometries) {
      if (this.ahead.has(i)) continue;
      this.ahead.set(i, this.copy(i));
      await pause();
    }
  }
  private copy(i: number): BufferGeometry {
    const geometry = this.geometries.get(i), row = this.rows.geometries.find(entry => entry.id === i);
    if (geometry === undefined || row === undefined) throw new Error(`[nine-dragon] no layout geometry ${i}`);
    const result = geometry.clone(); result.computeBoundingSphere();
    if (row.box) result.computeBoundingBox(); else result.boundingBox = null;
    return result;
  }
  /** Drop immutable source arrays after every runtime kit has taken its own mutable copy. */
  release(): void { for (const geometry of this.geometries.values()) geometry.dispose(); this.geometries.clear(); }
}

/** Read declared whole tiles through the game's verified product reader. */
export async function loadLayoutBake(owner: Scope): Promise<LayoutBake> {
  const product = await loadFirstPartyProduct('nine-dragon-stack', owner);
  const [boot, bytes] = await Promise.all([product.json<GeometryBoot>('geometry/layout.json'), product.file('geometry/layout-projection.json')]);
  const projection = JSON.parse(new TextDecoder().decode(bytes), layoutReviver) as LayoutProjection;
  const { library, rows } = boot;
  if (rows.geometries.length !== library.layoutDraws) throw new Error('Nine layout inventory differs');
  const views = await readWholeGeometry(owner, product.shardfile, library.layout), indexed = new Map<number, BufferGeometry>();
  // the square's sets are catalogue models now (generators/worldScenes.ts): their tiles are not read here
  const sets = new Set(rows.sets.map(row => row.geo));
  for (let i = 0; i < rows.geometries.length; i++) {
    if (sets.has(i)) continue;
    const view = views.get(`layout_${i}`);
    if (view === undefined || !view.matrix.equals(new Matrix4())) throw new Error(`Missing identity-space Nine layout draw ${i}`);
    view.release?.(); indexed.set(i, view.geometry);
  }
  if (views.size !== indexed.size) throw new Error('Unexpected Nine layout source draw');
  return new LayoutBake(projection, indexed);
}

/** The layout the page still builds from: its kits, their draw distances and drawn-in copies, the lanterns, the wall kit,
 *  the air conditioners, the grapple hooks and the facade shell (the rest of the bake's records are generators' inputs). */
export function restoreLayout(bake: LayoutBake): Ctx {
  const ctx: Ctx = { kits: new Map(), alphaKits: new Map(), farOf: new Map(), lanterns: [], acs: [], hooks: [], hookMounts: [], inKit: [], inst: new Map(), shell: null };
  const r = bake.rows;
  for (const [name, geo] of r.kits) ctx.kits.set(name, geo === null ? null : bake.geometry(geo));
  for (const [name, geo] of r.alphaKits) ctx.alphaKits.set(name, bake.geometry(geo));
  for (const [name, distance] of r.farOf) ctx.farOf.set(name, distance);
  ctx.lanterns.push(...r.lanterns.map(row => new Matrix4().fromArray(row)));
  ctx.acs.push(...r.acs.map(row => new Matrix4().fromArray(row)));
  ctx.hooks.push(...r.hooks.map(row => new Vector3(...row)));
  ctx.hookMounts.push(...r.hookMounts.map(row => ({ ring: new Vector3(...row.ring), out: new Vector3(...row.out) })));
  for (const [key, copies] of r.inst) ctx.inst.set(key, copies.map(row => ({ m: new Matrix4().fromArray(row.matrix), c: new Color(...row.color) })));
  if (r.shell !== null) ctx.shell = bake.geometry(r.shell);
  for (const k of r.inKit) {
    const b = k.box;
    ctx.inKit.push({ model: k.model, kit: k.kit, at: k.at, ...(b === null ? {} : { box: new Box3(new Vector3(b[0], b[1], b[2]), new Vector3(b[3], b[4], b[5])) }) });
  }
  bake.release();
  return ctx;
}

/** JSON keeps every double exactly but -0 and the non-finite: the bake writes those as strings (../generators/layout.ts) */
export function layoutReviver(_key: string, value: unknown): unknown {
  if (value === '-0') return -0;
  if (value === 'Infinity') return Number.POSITIVE_INFINITY;
  if (value === '-Infinity') return Number.NEGATIVE_INFINITY;
  return value;
}

