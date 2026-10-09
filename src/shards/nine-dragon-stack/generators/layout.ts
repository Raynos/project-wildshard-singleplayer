/**
 * Nine Dragon's layout bake (G285, SF72 "bake the code-built worlds"): the layout step — the square, the towers, the
 * Well — run at build time with a recording stand-in for the sign builder, and the build context it fills written as one
 * binary (a JSON head, float64 records, each built geometry's typed arrays). `scripts/bake-nine-layout.mjs` deflates it to
 * public/assets/nine-dragon/baked/layout.bin and stamps ../data/layout.json; the page restores it (../world/layoutBake.ts).
 * test/shards/nine-dragon-stack/layout-bake.test.ts re-runs it (the stale gate) and checks the restore against the
 * live builders.
 */
import { BufferAttribute, type BufferGeometry, type Color, Float16BufferAttribute, type Matrix4, type Vector3 } from 'three';
import { Ctx } from '../world/ctx';
import { Kit } from '../world/kit';
import { buildSquare } from '../world/square';
import { buildTowers } from '../world/towers';
import { buildWell } from '../world/well';
import { crossingColliders } from '../world/well-mid';
import { peekQueued, restoreQueued } from '../world/props3d';
import { wellSheets } from '../world/well-lower';
import { banyanOut } from '../world/banyan';
import { type SignPlace, type SignSink, signBoard, signSize } from '../look/signs';
import { NeonSigns } from '../look/neonsigns';
import { BAKED_BYTES, type BakedType, pad4 } from '../world/bakedGeometry';
import type { Placement } from '@wildshard/engine/models/model';
import { type BakedPlace, type LayoutRows, LayoutRowsSchema, type SignCallRow } from '../world/layoutBake';
import * as v from 'valibot';

const tuple = (p: Vector3): [number, number, number] => [p.x, p.y, p.z];

/** the page's sign builder as the layout sees it, recording every call in order (the boards still go into the kits) */
export class SignRecorder implements SignSink {
  readonly calls: SignCallRow[] = [];
  place(p: SignPlace, kit: Kit | null): { w: number; h: number } {
    const row: BakedPlace = { ...p, spec: { ...p.spec }, at: tuple(p.at), normal: tuple(p.normal) };
    this.calls.push({ k: 'place', p: row });
    // (the page sets the SDF calligraphy before the layout runs, so a tube sign is calligraphy: no board, NeonSigns' size)
    if (p.spec.style === 'tube') return NeonSigns.size(p.spec.text, p.size, p.spec.vertical);
    const size = signSize(p);
    if (kit !== null) signBoard(kit, p, size.w, size.h);
    return size;
  }
  light(c: Vector3, right: Vector3, up: Vector3, w: number, h: number, color: number, gain: number, mode: 1 | 2 = 1, seed = 0): void {
    this.calls.push({ k: 'light', c: tuple(c), r: tuple(right), u: tuple(up), w, h, color, gain, mode, seed });
  }
  tube(a: Vector3, b: Vector3, facing: Vector3, width: number, color: number, gain: number, flicker = 0): void {
    this.calls.push({ k: 'tube', a: tuple(a), b: tuple(b), f: tuple(facing), width, color, gain, flicker });
  }
}

/** the layout step as build.ts ran it live: the square, the towers, the Well, into a fresh context */
export function runLayout(signs: SignSink): Ctx {
  // (the lion and set queues fill across builds until the page's square props take them: start empty, as a page does)
  restoreQueued([], []);
  const ctx = new Ctx(signs);
  buildSquare(ctx);
  buildTowers(ctx);
  buildWell(ctx);
  return ctx;
}

function bakedType(attr: BufferAttribute): BakedType {
  if (attr instanceof Float16BufferAttribute) return 'f16';
  const a = attr.array;
  if (a instanceof Float32Array) return 'f32';
  if (a instanceof Uint16Array) return 'u16';
  if (a instanceof Int8Array) return 'i8';
  if (a instanceof Uint8Array) return 'u8';
  throw new Error('bake-nine-layout: an attribute type the bake does not store');
}

/** JSON keeps every double but -0 and the non-finite; those go as strings (world/layoutBake.ts `layoutReviver`) */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value !== 'number') return value;
  if (Object.is(value, -0)) return '-0';
  if (value === Number.POSITIVE_INFINITY) return 'Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  if (Number.isNaN(value)) throw new Error('bake-nine-layout: NaN in the layout');
  return value;
}

/** a model-in-kit copy's placement as the rows hold it: its pose, variant and plain params (anything else refuses the bake) */
function bakedAt(model: string, at: Placement<object>): LayoutRows['inKit'][number]['at'] {
  const { x, y, z, yaw, variant, params, ...rest } = at;
  if (Object.keys(rest).length > 0) throw new Error(`bake-nine-layout: '${model}' is placed with ${Object.keys(rest).join(', ')}, which the bake does not store`);
  const plain: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new Error(`bake-nine-layout: '${model}' has a param '${key}' the bake does not store`);
    plain[key] = value;
  }
  return { x, y, z, ...(yaw === undefined ? {} : { yaw }), ...(variant === undefined ? {} : { variant }), ...(params === undefined ? {} : { params: plain }) };
}

/** the layout, run and written as the bake's binary (inflated) */
export function bakeNineLayout(): Uint8Array {
  const signs = new SignRecorder();
  const ctx = runLayout(signs);
  const geometries: LayoutRows['geometries'] = [], blocks: Uint8Array[] = [];
  const addGeometry = (g: BufferGeometry): number => {
    const attrs: [string, BakedType, number, boolean][] = [];
    for (const [name, attr] of Object.entries(g.attributes)) {
      if (!(attr instanceof BufferAttribute)) throw new Error(`bake-nine-layout: '${name}' is interleaved`);
      const type = bakedType(attr);
      attrs.push([name, type, attr.itemSize, attr.normalized]);
      const bytes = new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.count * attr.itemSize * BAKED_BYTES[type]);
      const block = new Uint8Array(pad4(bytes.length));
      block.set(bytes);
      blocks.push(block);
    }
    const index = g.index;
    if (index !== null) {
      const deltas = new Int32Array(index.count);
      let last = 0;
      for (let i = 0; i < index.count; i++) { const x = index.getX(i); deltas[i] = x - last; last = x; }
      blocks.push(new Uint8Array(deltas.buffer));
    }
    geometries.push({ attrs, count: g.getAttribute('position').count, index: index === null ? null : index.array instanceof Uint16Array ? 'u16' : 'u32', indexCount: index?.count ?? 0, box: g.boundingBox !== null });
    return geometries.length - 1;
  };
  // the kits' names, the folded parts' too (a model drawn into a kit names its Kit object: build.ts `kitName`)
  const kitName = new Map<Kit, string>();
  for (const [name, k] of ctx.kits) {
    kitName.set(k, name);
    if ('extra' in k && Array.isArray(k.extra)) for (const e of k.extra) if (e instanceof Kit) kitName.set(e, name);
  }
  const kits = [...ctx.kits].map(([name, k]) => ({ name, geo: k.vertexCount > 0 ? addGeometry(k.build()) : null, compact: k.compact }));
  const alphaKits = [...ctx.alphaKits].filter(([, k]) => k.vertexCount > 0).map(([name, k]) => ({ name, geo: addGeometry(k.build()) }));
  const kitxs = [...ctx.kitxs].filter(([, k]) => k.vertexCount > 0).map(([name, k]) => ({ name, geo: addGeometry(k.build()) }));
  const f64: number[] = [];
  const m4 = (m: Matrix4): void => { f64.push(...m.elements); };
  const v3 = (p: Vector3): void => { f64.push(p.x, p.y, p.z); };
  const col = (c: Color): void => { f64.push(c.r, c.g, c.b); };
  ctx.walkers.forEach(m4); ctx.sitters.forEach(m4); ctx.lanterns.forEach(m4); ctx.acs.forEach(m4);
  ctx.hooks.forEach(v3);
  for (const h of ctx.hookMounts) { v3(h.ring); v3(h.out); }
  ctx.steam.forEach(v3);
  for (const p of ctx.fd.pieces) { m4(p.m); col(p.c); }
  for (const w of ctx.fd.windows) { m4(w.m); f64.push(w.win.x, w.win.y, w.win.z, w.win.w); col(w.wall); col(w.light); }
  for (const list of ctx.inst.values()) for (const it of list) { m4(it.m); col(it.c); }
  const queued = peekQueued();
  queued.lions.forEach(m4);
  for (const [, s] of queued.sets) s.at.forEach(m4);
  const sets = queued.sets.map(([name, s]) => ({ name, geo: addGeometry(s.geo), count: s.at.length }));
  const shell = ctx.fd.shell.vertexCount > 0 ? addGeometry(ctx.fd.shell.build()) : null;
  const plan = banyanOut.plan;
  const draft: LayoutRows = {
    version: 1, geometries, kits, alphaKits, kitxs,
    reflective: [...ctx.reflective], farOf: [...ctx.farOf],
    counts: { walkers: ctx.walkers.length, sitters: ctx.sitters.length, lanterns: ctx.lanterns.length, acs: ctx.acs.length, hooks: ctx.hooks.length, hookMounts: ctx.hookMounts.length, steam: ctx.steam.length, pieces: ctx.fd.pieces.length, windows: ctx.fd.windows.length, lions: queued.lions.length },
    inKit: ctx.inKit.map((c) => {
      const kit = kitName.get(c.kit);
      if (kit === undefined) throw new Error(`bake-nine-layout: '${c.model}' is drawn into a kit that is no named kit`);
      const b = c.box;
      return { model: c.model, kit, at: bakedAt(c.model, c.at), box: b === undefined ? null : [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z] };
    }),
    map: ctx.map.map((m) => ({ ...m })),
    emitters: ctx.emitters.map((e) => ({ at: tuple(e.at), color: [e.color.r, e.color.g, e.color.b], w: e.w, h: e.h, power: e.power, spill: e.spill })),
    pieces: ctx.fd.pieces.map((p) => p.piece),
    slots: { early: ctx.fd.signs.map((s) => ({ at: tuple(s.at), normal: tuple(s.normal), size: s.size, color: s.color, blade: s.blade })), late: [] },
    shell, towers: ctx.fd.towers,
    inst: [...ctx.inst].map(([key, list]) => [key, list.length]),
    rng: ctx.rng.snapshot(),
    signs: signs.calls,
    crossings: crossingColliders().map((c) => {
      if (c.kind !== 'box') throw new Error(`bake-nine-layout: a crossing collider of kind '${c.kind}'`);
      return c;
    }),
    sets,
    sheets: wellSheets.map((s) => ({ y: s.y, band: s.band, a: s.a })),
    banyan: plan === null ? null : { lumps: plan.lumps.map((l) => ({ c: tuple(l.c), r: tuple(l.r), up: l.up, seed: l.seed, wash: l.wash })), hangs: plan.hangs.map(tuple) },
  };
  const rows = v.parse(LayoutRowsSchema, draft);
  const json = new TextEncoder().encode(JSON.stringify(rows, replacer));
  const head = Math.ceil((8 + json.length) / 8) * 8;
  const geoBytes = blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(head + f64.length * 8 + geoBytes);
  const view = new DataView(out.buffer);
  view.setUint32(0, json.length, true);
  view.setUint32(4, f64.length, true);
  out.set(json, 8);
  out.set(new Uint8Array(new Float64Array(f64).buffer), head);
  let at = head + f64.length * 8;
  for (const b of blocks) { out.set(b, at); at += b.length; }
  return out;
}
