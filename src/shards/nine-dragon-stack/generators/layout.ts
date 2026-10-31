/**
 * Nine Dragon's authored square, towers and Well, built with a recording sign sink.
 * worldProgram.ts caches the checked layout rows, float64 records and immutable
 * world GLBs. Product consumers receive those owned values directly.
 */
import { BufferAttribute, BufferGeometry, Float16BufferAttribute, Uint32BufferAttribute, type Color, type Matrix4, type Vector3 } from 'three';
import { mergeKits } from './kit/sweptKit';
import { Ctx } from './ctx';
import { Kit } from './kit';
import { buildSquare } from './square';
import { buildTowers } from './towers';
import { buildWell } from './well';
import { mergeBakedPieces } from './facadePieces';
import { peekQueued, restoreQueued } from './props3d';
import { crossingColliders, wellSheets } from './wellBounds';
import { banyanOut } from './banyanPlan';
import type { SignPlace, SignSink, SignBoardKit } from './contracts/signPlacement';
import { signBoard, signSize, neonSize } from './signMath';
import { geometryWriter } from './bakeWrite';
import type { AuthoredPlacement as Placement } from './contracts/modelPlacement';
import { type BakedPlace, type LayoutRows, LayoutRowsSchema, type SignCallRow } from './sections';
import { parseSectionValue } from '@wildshard/sdk/sections';

const tuple = (p: Vector3): [number, number, number] => [p.x, p.y, p.z];

/** the page's sign builder as the layout sees it, recording every call in order (the boards still go into the kits) */
export class SignRecorder implements SignSink {
  readonly calls: SignCallRow[] = [];
  place(p: SignPlace, kit: SignBoardKit | null): { w: number; h: number } {
    const row: BakedPlace = { ...p, spec: { ...p.spec }, at: tuple(p.at), normal: tuple(p.normal) };
    this.calls.push({ k: 'place', p: row });
    // (the page sets the SDF calligraphy before the layout runs, so a tube sign is calligraphy: no board, NeonText's size)
    if (p.spec.style === 'tube') return neonSize(p.spec.text, p.size, p.spec.vertical);
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

/** the layout step as build.ts ran it live: the square, the towers, the Well, into a fresh context; then the facade's
 *  small pieces merged into the shell (`merge` false: left for the caller, as the page's batch did before G285 moved it) */
export function runLayout(signs: SignSink, merge = true): Ctx {
  // (the lion and set queues fill across builds until the page's square props take them: start empty, as a page does)
  restoreQueued([], []);
  const ctx = new Ctx(signs);
  buildSquare(ctx);
  buildTowers(ctx);
  buildWell(ctx);
  if (merge) mergeBakedPieces(ctx.fd);
  return ctx;
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

/** G5: a kit's flagstone faces (aPat.x kind 3) apart from its other faces, each with only the vertices it indexes (raw words
 *  copied, the half-float class kept). The flagstones draw through the kind-3 program (architectureGraphs `only`), which
 *  at the phone's street pose (a) is 72 % of the frame's pixels at about a quarter less GPU time than the kit's program. */
function splitKind(geometry: BufferGeometry, kind: number): { rest: BufferGeometry | null; only: BufferGeometry | null; maps: readonly [Int32Array, Int32Array] } {
  const pat = geometry.getAttribute('aPat'), index = geometry.index, count = geometry.getAttribute('position').count;
  if (pat === undefined || index === null) throw new Error('Nine kit split needs an indexed aPat');
  const of = (vertex: number): number => Math.floor(pat.getX(vertex) + 0.5), sides: [number[], number[]] = [[], []];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    sides[of(a) === kind && of(b) === kind && of(c) === kind ? 1 : 0].push(a, b, c);
  }
  const maps: [Int32Array, Int32Array] = [new Int32Array(count).fill(-1), new Int32Array(count).fill(-1)];
  const part = (triangles: readonly number[], map: Int32Array): BufferGeometry | null => {
    if (triangles.length === 0) return null;
    const order: number[] = [];
    const indices = triangles.map(vertex => { let at = map[vertex] ?? -1; if (at === -1) { at = order.length; map[vertex] = at; order.push(vertex); } return at; });
    const out = new BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (!(attribute instanceof BufferAttribute)) throw new Error(`Nine kit split: ${name} is interleaved`);
      const size = attribute.itemSize, source = attribute.array, words = new (source.constructor as new (length: number) => typeof source)(order.length * size);
      order.forEach((vertex, at) => { for (let k = 0; k < size; k++) words[at * size + k] = source[vertex * size + k] ?? 0; });
      out.setAttribute(name, attribute instanceof Float16BufferAttribute ? new Float16BufferAttribute(words, size, attribute.normalized) : new BufferAttribute(words, size, attribute.normalized));
    }
    out.setIndex(new Uint32BufferAttribute(indices, 1)); out.computeBoundingSphere();
    return out;
  };
  return { rest: part(sides[0], maps[0]), only: part(sides[1], maps[1]), maps };
}

/** A split kit as it was before the split: its coarse copy simplifies it whole (scene.ts), its spill gathered back from
 *  the two sides' (each vertex's spill is its own: lightSpill.ts) through `maps` (a source vertex's index in each side, or -1). */
export interface WholeKit { readonly name: string; readonly geometry: BufferGeometry; readonly maps: readonly [Int32Array, Int32Array] }

/** the layout, run and written as the bake's binary (inflated) */
export function nineLayoutSource(): { bin: Uint8Array; rows: LayoutRows; records: number[]; geometries: BufferGeometry[]; wholes: ReadonlyMap<number, WholeKit> } {
  const signs = new SignRecorder();
  const ctx = runLayout(signs);
  const built: BufferGeometry[] = [], geometries: LayoutRows['geometries'] = [], writer = geometryWriter('bake-nine-layout'), blocks = writer.blocks;
  const addGeometry = (g: BufferGeometry): number => { built.push(g); geometries.push(writer.add(g)); return geometries.length - 1; };
  // the kits' names, the folded parts' too (a model drawn into a kit names its Kit object: build.ts `kitName`)
  const kitName = new Map<Kit, string>();
  for (const [name, k] of ctx.kits) {
    kitName.set(k, name);
    if ('extra' in k && Array.isArray(k.extra)) for (const e of k.extra) if (e instanceof Kit) kitName.set(e, name);
  }
  // Native boot used to merge solid and swept builders by name. Emit those final
  // streams in the same order, including swept-only names after the solid names.
  // the flagstones' geometries follow every other layout geometry, so the others keep their ids
  const grounds: [string, BufferGeometry][] = [], wholes = new Map<number, WholeKit>();
  const kits = [...ctx.kits].map(([name, k]) => {
    const extra = ctx.kitxs.get(name), base = k.vertexCount > 0 ? k.build() : null;
    const swept = extra !== undefined && extra.vertexCount > 0 ? extra.build() : null;
    const merged = base === null ? swept : swept === null ? base : mergeKits([base, swept]);
    const split = merged === null ? null : splitKind(merged, 3), geometry = split === null ? null : split.rest;
    if (split !== null && split.only !== null) grounds.push([name, split.only]);
    geometry?.computeBoundingSphere();
    const geo = geometry === null ? null : addGeometry(geometry);
    if (geo !== null && merged !== null && split !== null && split.only !== null) wholes.set(geo, { name, geometry: merged, maps: split.maps });
    return { name, geo, compact: k.compact };
  });
  for (const [name, k] of ctx.kitxs) if (!ctx.kits.has(name) && k.vertexCount > 0) {
    const geometry = k.build(); geometry.computeBoundingSphere();
    kits.push({ name, geo: addGeometry(geometry), compact: false });
  }
  const alphaKits = [...ctx.alphaKits].filter(([, k]) => k.vertexCount > 0).map(([name, k]) => ({ name, geo: addGeometry(k.build()) }));
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
  const groundKits = grounds.map(([name, geometry]) => ({ name, geo: addGeometry(geometry) }));
  const plan = banyanOut.plan;
  const draft: LayoutRows = {
    version: 1, geometries, kits, alphaKits, groundKits, kitxs: [],
    reflective: [...ctx.reflective], farOf: [...ctx.farOf],
    counts: { walkers: ctx.walkers.length, sitters: ctx.sitters.length, lanterns: ctx.lanterns.length, acs: ctx.acs.length, hooks: ctx.hooks.length, hookMounts: ctx.hookMounts.length, steam: ctx.steam.length, pieces: ctx.fd.pieces.length, windows: ctx.fd.windows.length, lions: queued.lions.length },
    inKit: ctx.inKit.map((c) => {
      const kit = kitName.get(c.kit);
      if (kit === undefined) throw new Error(`bake-nine-layout: '${c.model}' is drawn into a kit that is no named kit`);
      const b = c.box;
      if (b.isEmpty()) throw new Error(`bake-nine-layout: '${c.model}' measured no drawn vertices in kit ${kit}`);
      return { model: c.model, kit, at: bakedAt(c.model, c.at), box: [b.min.x + 0, b.min.y + 0, b.min.z + 0, b.max.x + 0, b.max.y + 0, b.max.z + 0] };
    }),
    map: ctx.map.map((m) => ({ ...m })),
    emitters: ctx.emitters.map((e) => ({ at: tuple(e.at), color: [e.color.r, e.color.g, e.color.b], w: e.w, h: e.h, power: e.power, spill: e.spill })),
    pieces: ctx.fd.pieces.map((p) => p.piece),
    slots: { early: ctx.fd.signs.map((s) => ({ at: tuple(s.at), normal: tuple(s.normal), size: s.size, color: s.color, blade: s.blade })), late: [] },
    shell, towers: ctx.fd.towers,
    merged: [...ctx.fd.merged].map(([id, b]) => [id, [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]]),
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
  const rows = parseSectionValue(LayoutRowsSchema, draft);
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
  return { bin: out, rows, records: f64, geometries: built, wholes };
}

