/**
 * Restore the offline layout into its unchanged native kits, facade, crowd and
 * placement owners. The admitted product carries small validated row JSON and
 * exact float64 records separately from its standard GLB source geometries.
 */
import { Box3, type BufferGeometry, Color, Matrix4, Vector3 } from 'three';
import type { LayoutRows, GeometryBoot } from '../runtime/productSections.generated';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Ctx } from './ctx';

/** Standard GLB layout geometries and plain double-precision author rows. */
export class LayoutBake {
  readonly rows: LayoutRows;
  readonly f64: Float64Array;
  /** `records`: a Float64Array is taken as is (the runtime reader revives the rows into one), any other list is copied */
  constructor(rows: LayoutRows, records: Float64Array | readonly number[], private readonly geometries: Map<number, BufferGeometry>) {
    this.rows = rows; this.f64 = records instanceof Float64Array ? records : Float64Array.from(records);
  }
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
    const r = this.rows;
    if (r.kitxs.length > 0) throw new Error('Nine layout requires offline merged kits');
    const used = [...r.kits.flatMap(k => (k.geo === null ? [] : [k.geo])), ...r.alphaKits.map(k => k.geo),
      ...(r.shell === null ? [] : [r.shell])];
    for (const i of used) {
      if (this.ahead.has(i)) continue;
      this.ahead.set(i, this.copy(i));
      await pause();
    }
  }
  private copy(i: number): BufferGeometry {
    const geometry = this.geometries.get(i), row = this.rows.geometries[i];
    if (geometry === undefined || row === undefined) throw new Error(`[nine-dragon] no layout geometry ${i}`);
    const result = geometry.clone(); result.computeBoundingSphere();
    if (row.box) result.computeBoundingBox(); else result.boundingBox = null;
    return result;
  }
  /** Drop immutable source arrays after every runtime kit has taken its own mutable copy. */
  release(): void { for (const geometry of this.geometries.values()) geometry.dispose(); this.geometries.clear(); }
}

/** JSON admission normalizes zero; restore the explicitly declared negative-zero words exactly. */
export function restoreLayoutZeros({ rows: source, negativeZeros }: GeometryBoot): LayoutRows {
  const rows = structuredClone(source);
  for (const path of negativeZeros) {
    let parent: unknown = rows;
    for (const key of path.slice(0, -1)) {
      if (parent === null || typeof parent !== 'object') throw new Error('Invalid Nine signed-zero path');
      parent = Reflect.get(parent, key);
    }
    const key = path.at(-1);
    if (parent === null || typeof parent !== 'object' || key === undefined || Reflect.get(parent, key) !== 0) throw new Error('Invalid Nine signed-zero word');
    Reflect.set(parent, key, -0);
  }
  return rows;
}

/** Read declared whole tiles through the game's verified product reader. */
export async function loadLayoutBake(owner: Scope): Promise<LayoutBake> {
  const product = await loadFirstPartyProduct('nine-dragon-stack', owner);
  const [boot, bytes] = await Promise.all([product.json<GeometryBoot>('geometry/layout.json'), product.file('geometry/layout-f64.bin')]);
  const rows = restoreLayoutZeros(boot), { library } = boot;
  if (bytes.byteLength !== library.records * 8 || rows.geometries.length !== library.layoutDraws) throw new Error('Nine layout inventory differs');
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
  return new LayoutBake(rows, new Float64Array(Uint8Array.from(bytes).buffer), indexed);
}

/** The layout the page still builds from: its kits, their draw distances and drawn-in copies, the lanterns, the wall kit,
 *  the air conditioners, the grapple hooks and the facade shell (the rest of the bake's records are generators' inputs). */
export function restoreLayout(bake: LayoutBake): Ctx {
  const ctx: Ctx = { kits: new Map(), alphaKits: new Map(), farOf: new Map(), lanterns: [], acs: [], hooks: [], hookMounts: [], inKit: [], inst: new Map(), shell: null };
  const r = bake.rows, f = bake.f64, c = r.counts;
  let at = (c.walkers + c.sitters) * 16;
  const num = (): number => { const x = f[at++]; if (x === undefined) throw new Error('[nine-dragon] the layout bake ran out of records'); return x; };
  const m4 = (): Matrix4 => { const m = new Matrix4(); for (let i = 0; i < 16; i++) m.elements[i] = num(); return m; };
  const v3 = (): Vector3 => new Vector3(num(), num(), num());
  for (const k of r.kits) ctx.kits.set(k.name, k.geo === null ? null : bake.geometry(k.geo));
  for (const k of r.alphaKits) ctx.alphaKits.set(k.name, bake.geometry(k.geo));
  for (const [name, m] of r.farOf) ctx.farOf.set(name, m);
  for (let i = 0; i < c.lanterns; i++) ctx.lanterns.push(m4());
  for (let i = 0; i < c.acs; i++) ctx.acs.push(m4());
  for (let i = 0; i < c.hooks; i++) ctx.hooks.push(v3());
  for (let i = 0; i < c.hookMounts; i++) ctx.hookMounts.push({ ring: v3(), out: v3() });
  at += c.steam * 3 + c.pieces * 19 + c.windows * 26;
  for (const [key, n] of r.inst) ctx.inst.set(key, Array.from({ length: n }, () => ({ m: m4(), c: new Color(num(), num(), num()) })));
  at += (c.lions + r.sets.reduce((sum, row) => sum + row.count, 0)) * 16;
  if (at !== f.length) throw new Error('[nine-dragon] the layout bake has records left over');
  if (r.shell !== null) ctx.shell = bake.geometry(r.shell);
  for (const k of r.inKit) {
    if (!ctx.kits.has(k.kit)) throw new Error(`[nine-dragon] the layout bake draws '${k.model}' into no kit '${k.kit}'`);
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

