/**
 * Nine Dragon's layout drawn from its offline bake (G285, SF72 "bake the code-built worlds"). The layout step — the
 * square, the towers, the Well (../generators/square.ts, towers.ts, well.ts) — is a pure function of committed code, so
 * `../generators/layout.ts` runs it at build time (`src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs`) and stores the build context it fills:
 * every kit's built geometry, the facade dressing (pieces, windows, sign slots, the shell), the instance lists, the
 * models drawn into kits, the map's floor plan, the emitters, the crossings' colliders, the lion and set queues, the
 * banyan's plan, and the 1,156 sign calls in the order the builders made them. `restoreLayout` fills a page's `Ctx` from
 * it and replays the signs into the page's own SignBuilder, so build.ts carries on exactly as after the builders ran.
 */
import { Box3, Color, Matrix4, Vector3, Vector4 } from 'three';
import * as v from 'valibot';
import type { Ctx, InKit, MapRect } from './ctx';
import { Kit } from './kit';
import { KitX } from './hero/kitx';
import { Builder } from './facade/geo';
import { isPiece } from './facade/pieceIds';
import type { Material } from '@wildshard/engine/physics/surface';
import type { SignPlace, SignSink } from '../look/signs';
import type { SignStyle } from '../data/signs';
import { type BakedGeometryRow, bakedGeometryBytes, readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';
import { restoreQueued } from './props3d';
import { restoreCrossingColliders, wellSheets } from './wellBounds';
import { banyanOut } from './banyanPlan';
import rows from '../data/layout.json' with { type: 'json' };

/** the bake's binary (`src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs`); listed in the boot's world reads (../boot/files.ts) */
export const LAYOUT_BAKE_URL = '/assets/nine-dragon/baked/layout.bin';
/** the bake's stamp: the inflated binary's hash and size (the stale gate, test/shards/nine-dragon-stack/layout-bake.test.ts) */
export const LAYOUT_STAMP = v.parse(v.strictObject({ version: v.literal(1), bin: v.string(), bytes: v.number() }), rows);

const finite = v.number();
const SURFACES: readonly Material[] = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand'];
const V3 = v.tuple([finite, finite, finite]);
const STYLES: readonly SignStyle[] = ['tube', 'box', 'plaque', 'paper', 'talisman', 'etch', 'banner'];
const Spec = v.strictObject({ text: v.string(), color: v.string(), vertical: v.boolean(), style: v.picklist(STYLES), ink: v.exactOptional(v.string()) });
const Place = v.strictObject({
  at: V3, normal: V3, size: finite, spec: Spec, gain: v.exactOptional(finite), flicker: v.exactOptional(finite), blade: v.exactOptional(v.boolean()),
  board: v.exactOptional(finite), fogK: v.exactOptional(finite), clear: v.exactOptional(finite),
});
const SignCall = v.variant('k', [
  v.strictObject({ k: v.literal('place'), p: Place }),
  v.strictObject({ k: v.literal('light'), c: V3, r: V3, u: V3, w: finite, h: finite, color: finite, gain: finite, mode: v.picklist([1, 2] as const), seed: finite }),
  v.strictObject({ k: v.literal('tube'), a: V3, b: V3, f: V3, width: finite, color: finite, gain: finite, flicker: finite }),
]);
const Geometry = v.strictObject({
  attrs: v.array(v.tuple([v.string(), v.picklist(['f32', 'f16', 'u16', 'i8', 'u8'] as const), finite, v.boolean()])),
  count: finite, index: v.nullable(v.picklist(['u16', 'u32'] as const)), indexCount: finite, box: v.boolean(),
});
const Slot = v.strictObject({ at: V3, normal: V3, size: finite, color: finite, blade: v.boolean() });
const Named = v.strictObject({ name: v.string(), geo: finite });
const KINDS: readonly MapRect['kind'][] = ['block', 'street', 'well', 'plaza', 'green', 'gate'];
const Params = v.record(v.string(), v.union([finite, v.string(), v.boolean()]));
const Box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: finite, hy: finite, hz: finite,
  yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })), surface: v.exactOptional(v.picklist(SURFACES)) });

/** the bake's rows (the binary's JSON head), strictly */
export const LayoutRowsSchema = v.strictObject({
  version: v.literal(1),
  geometries: v.array(Geometry),
  kits: v.array(v.strictObject({ name: v.string(), geo: v.nullable(finite), compact: v.boolean() })),
  alphaKits: v.array(Named),
  kitxs: v.array(Named),
  reflective: v.array(v.string()),
  farOf: v.array(v.tuple([v.string(), finite])),
  counts: v.strictObject({ walkers: finite, sitters: finite, lanterns: finite, acs: finite, hooks: finite, hookMounts: finite, steam: finite, pieces: finite, windows: finite, lions: finite }),
  inKit: v.array(v.strictObject({ model: v.string(), kit: v.string(), at: v.strictObject({ x: finite, y: finite, z: finite, yaw: v.exactOptional(finite), variant: v.exactOptional(v.string()), params: v.exactOptional(Params) }), box: v.nullable(v.tuple([finite, finite, finite, finite, finite, finite])) })),
  map: v.array(v.strictObject({ x0: finite, z0: finite, x1: finite, z1: finite, kind: v.picklist(KINDS) })),
  emitters: v.array(v.strictObject({ at: V3, color: V3, w: finite, h: finite, power: finite, spill: finite })),
  pieces: v.array(v.string()),
  slots: v.strictObject({ early: v.array(Slot), late: v.array(Slot) }),
  shell: v.nullable(finite),
  towers: finite,
  merged: v.array(v.tuple([v.string(), v.tuple([finite, finite, finite, finite, finite, finite])])),
  inst: v.array(v.tuple([v.string(), finite])),
  rng: v.strictObject({ version: finite, state: finite, initial: finite, scrambledFork: v.boolean() }),
  signs: v.array(SignCall),
  crossings: v.array(Box),
  sets: v.array(v.strictObject({ name: v.string(), geo: finite, count: finite })),
  sheets: v.array(v.strictObject({ y: finite, band: finite, a: finite })),
  banyan: v.nullable(v.strictObject({ lumps: v.array(v.strictObject({ c: V3, r: V3, up: finite, seed: finite, wash: finite })), hangs: v.array(V3) })),
});
export type LayoutRows = v.InferOutput<typeof LayoutRowsSchema>;
export type SignCallRow = v.InferOutput<typeof SignCall>;
export type BakedPlace = v.InferOutput<typeof Place>;

/** JSON keeps every double exactly but -0 and the non-finite: the bake writes those as strings (../generators/layout.ts) */
export function layoutReviver(_key: string, value: unknown): unknown {
  if (value === '-0') return -0;
  if (value === 'Infinity') return Number.POSITIVE_INFINITY;
  if (value === '-Infinity') return Number.NEGATIVE_INFINITY;
  return value;
}

/** The decoded binary: its rows, its float64 records and its geometry blocks. */
export class LayoutBake {
  readonly rows: LayoutRows;
  readonly f64: Float64Array;
  private readonly geoAt: number[] = [];
  constructor(private readonly bytes: Uint8Array) {
    if (bytes.length !== LAYOUT_STAMP.bytes) throw new Error(`[nine-dragon] the layout bake holds ${String(bytes.length)} bytes, its stamp ${String(LAYOUT_STAMP.bytes)}`);
    const head = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const jsonBytes = head.getUint32(0, true), f64Count = head.getUint32(4, true);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + jsonBytes)), layoutReviver);
    this.rows = v.parse(LayoutRowsSchema, parsed);
    let at = Math.ceil((8 + jsonBytes) / 8) * 8;
    this.f64 = new Float64Array(bytes.slice(at, at + f64Count * 8).buffer);
    at += f64Count * 8;
    for (const g of this.rows.geometries) { this.geoAt.push(at); at += bakedGeometryBytes(g); }
    if (at !== bytes.length) throw new Error('[nine-dragon] the layout bake does not match its rows');
  }
  geometry(i: number): ReturnType<typeof readBakedGeometry> {
    const row: BakedGeometryRow | undefined = this.rows.geometries[i], at = this.geoAt[i];
    if (row === undefined || at === undefined) throw new Error(`[nine-dragon] no baked layout geometry ${String(i)}`);
    return readBakedGeometry(this.bytes, at, row);
  }
}

/** Fetch and inflate the bake. It is mandatory: the layout's builders are build-time code (../generators/), so a missing
 *  or mismatched bake fails the world build (the stale gate, test/shards/nine-dragon-stack/layout-bake.test.ts, keeps the
 *  committed bake current). */
export async function loadLayoutBake(): Promise<LayoutBake> {
  const response = await fetch(LAYOUT_BAKE_URL);
  if (!response.ok || response.body === null) throw new Error(`[nine-dragon] the layout bake did not load: ${String(response.status)} ${LAYOUT_BAKE_URL}`);
  return new LayoutBake(new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()));
}

const vec = (a: readonly [number, number, number]): Vector3 => new Vector3(a[0], a[1], a[2]);

/** one recorded sign call into a sign builder (the boards are in the baked kits already, so no kit is passed) */
export function replaySign(signs: SignSink, call: SignCallRow): void {
  if (call.k === 'place') {
    const { at, normal, ...rest } = call.p;
    const p: SignPlace = { ...rest, at: vec(at), normal: vec(normal) };
    signs.place(p, null);
  } else if (call.k === 'light') signs.light(vec(call.c), vec(call.r), vec(call.u), call.w, call.h, call.color, call.gain, call.mode, call.seed);
  else signs.tube(vec(call.a), vec(call.b), vec(call.f), call.width, call.color, call.gain, call.flicker);
}

/** fill `ctx` (fresh) from the bake as the layout builders would have, replaying the signs into `ctx.signs` */
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
    kit.compact = k.compact;
    ctx.kits.set(k.name, kit);
    byName.set(k.name, kit);
  }
  for (const k of r.alphaKits) ctx.alphaKits.set(k.name, Kit.fromBake(bake.geometry(k.geo)));
  for (const k of r.kitxs) ctx.kitxs.set(k.name, KitX.fromBake(bake.geometry(k.geo)));
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
  if (r.shell !== null) ctx.fd.shell = Builder.fromBake(bake.geometry(r.shell));
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
  for (const call of r.signs) replaySign(ctx.signs, call);
  restoreCrossingColliders(r.crossings);
  restoreQueued(lions, sets);
  wellSheets.length = 0;
  wellSheets.push(...r.sheets);
  banyanOut.plan = r.banyan === null ? null : {
    lumps: r.banyan.lumps.map((l) => ({ c: vec(l.c), r: vec(l.r), up: l.up, seed: l.seed, wash: l.wash })),
    hangs: r.banyan.hangs.map(vec),
  };
}
