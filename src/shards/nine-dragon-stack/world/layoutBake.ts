/**
 * Restore the offline layout into its unchanged native kits, facade, crowd and
 * placement owners. The admitted product carries small validated row JSON and
 * exact float64 records separately from its standard GLB source geometries.
 */
import { Box3, type BufferGeometry, Color, Matrix4, Vector3, Vector4 } from 'three';
import type { LayoutRows, GeometryBoot } from '../runtime/productSections.generated';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Ctx, InKit } from './ctx';
import { Kit } from './kit';
import { isPiece } from './facade/pieceIds';
import { restoreQueued } from './props3d';
import { restoreCrossingColliders, wellSheets } from './wellBounds';
import { banyanOut } from './banyanPlan';



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
    const used = [...r.kits.flatMap(k => (k.geo === null ? [] : [k.geo])), ...r.alphaKits.map(k => k.geo), ...r.kitxs.map(k => k.geo),
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
  for (let i = 0; i < rows.geometries.length; i++) {
    const view = views.get(`layout_${i}`);
    if (view === undefined || !view.matrix.equals(new Matrix4())) throw new Error(`Missing identity-space Nine layout draw ${i}`);
    view.release?.(); indexed.set(i, view.geometry);
  }
  if (views.size !== indexed.size) throw new Error('Unexpected Nine layout source draw');
  return new LayoutBake(rows, new Float64Array(Uint8Array.from(bytes).buffer), indexed);
}

const vec = (a: readonly [number, number, number]): Vector3 => new Vector3(a[0], a[1], a[2]);

export function restoreLayout(bake: LayoutBake, ctx: Ctx): void {
  const r = bake.rows, f = bake.f64;
  let at = 0;
  const num = (): number => { const x = f[at++]; if (x === undefined) throw new Error('[nine-dragon] the layout bake ran out of records'); return x; };
  const m4 = (): Matrix4 => { const m = new Matrix4(); for (let i = 0; i < 16; i++) m.elements[i] = num(); return m; };
  const v3 = (): Vector3 => new Vector3(num(), num(), num());
  const col = (): Color => new Color(num(), num(), num());
  const byName = new Map<string, Kit>();
  for (const k of r.kits) {
    const kit = k.geo === null ? new Kit() : Kit.fromBake(bake.geometry(k.geo));
    ctx.kits.set(k.name, kit);
    byName.set(k.name, kit);
  }
  for (const k of r.alphaKits) ctx.alphaKits.set(k.name, Kit.fromBake(bake.geometry(k.geo)));
  for (const k of r.kitxs) ctx.kitxs.set(k.name, Kit.fromBake(bake.geometry(k.geo)));
  for (const name of r.reflective) ctx.reflective.add(name);
  for (const [name, m] of r.farOf) ctx.far(name, m);
  const c = r.counts;
  for (let i = 0; i < c.walkers; i++) ctx.walkers.push(m4());
  for (let i = 0; i < c.sitters; i++) ctx.sitters.push(m4());
  for (let i = 0; i < c.lanterns; i++) ctx.lanterns.push(m4());
  for (let i = 0; i < c.acs; i++) ctx.acs.push(m4());
  for (let i = 0; i < c.hooks; i++) ctx.hooks.push(v3());
  for (let i = 0; i < c.hookMounts; i++) ctx.hookMounts.push({ ring: v3(), out: v3() });
  for (let i = 0; i < c.steam; i++) ctx.steam.push(v3());
  for (const piece of r.pieces) {
    if (!isPiece(piece)) throw new Error(`[nine-dragon] the layout bake places no facade piece '${piece}'`);
    ctx.fd.pieces.push({ piece, m: m4(), c: col() });
  }
  for (let i = 0; i < c.windows; i++) ctx.fd.windows.push({ m: m4(), win: new Vector4(num(), num(), num(), num()), wall: col(), light: col() });
  for (const [key, n] of r.inst) {
    const list = [];
    for (let i = 0; i < n; i++) list.push({ m: m4(), c: col() });
    ctx.inst.set(key, list);
  }
  const lions: Matrix4[] = [];
  for (let i = 0; i < c.lions; i++) lions.push(m4());
  const sets = r.sets.map((s) => {
    const list: Matrix4[] = [];
    for (let i = 0; i < s.count; i++) list.push(m4());
    return [s.name, { geo: bake.geometry(s.geo), at: list }] as const;
  });
  if (at !== f.length) throw new Error('[nine-dragon] the layout bake has records left over');
  for (const s of r.slots.early) ctx.fd.addSign({ ...s, at: vec(s.at), normal: vec(s.normal) });
  ctx.fd.late = true;
  for (const s of r.slots.late) ctx.fd.addSign({ ...s, at: vec(s.at), normal: vec(s.normal) });
  ctx.fd.late = false;
  if (r.shell !== null) ctx.fd.shell = bake.geometry(r.shell);
  ctx.fd.towers = r.towers;
  for (const [id, b] of r.merged) {
    if (!isPiece(id)) throw new Error(`[nine-dragon] the layout bake merges no facade piece '${id}'`);
    ctx.fd.merged.set(id, new Box3(new Vector3(b[0], b[1], b[2]), new Vector3(b[3], b[4], b[5])));
  }
  for (const k of r.inKit) {
    const kit = byName.get(k.kit);
    if (kit === undefined) throw new Error(`[nine-dragon] the layout bake draws '${k.model}' into no kit '${k.kit}'`);
    const b = k.box;
    const copy: InKit = { model: k.model, kit, at: k.at, ...(b === null ? {} : { box: new Box3(new Vector3(b[0], b[1], b[2]), new Vector3(b[3], b[4], b[5])) }) };
    ctx.inKit.push(copy);
  }
  for (const m of r.map) ctx.map.push({ ...m });
  for (const e of r.emitters) ctx.emitters.push({ at: vec(e.at), color: new Color(e.color[0], e.color[1], e.color[2]), w: e.w, h: e.h, power: e.power, spill: e.spill });
  ctx.rng.restore(r.rng);
  restoreCrossingColliders(r.crossings);
  restoreQueued(lions, sets);
  wellSheets.length = 0;
  wellSheets.push(...r.sheets);
  banyanOut.plan = r.banyan === null ? null : {
    lumps: r.banyan.lumps.map((l) => ({ c: vec(l.c), r: vec(l.r), up: l.up, seed: l.seed, wash: l.wash })),
    hangs: r.banyan.hangs.map(vec),
  };
  bake.release();
}

/** JSON keeps every double exactly but -0 and the non-finite: the bake writes those as strings (../generators/layout.ts) */
export function layoutReviver(_key: string, value: unknown): unknown {
  if (value === '-0') return -0;
  if (value === 'Infinity') return Number.POSITIVE_INFINITY;
  if (value === '-Infinity') return Number.NEGATIVE_INFINITY;
  return value;
}

