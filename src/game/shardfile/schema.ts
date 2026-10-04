import * as v from 'valibot';
import { CELL_ABOVE, CELL_BELOW, CHUNK_HALF, CONTENT_CAPS } from '@wildshard/engine/core/config';
import { SHARDFILE_VERSION } from './version';
import { UiSchema, uiRules } from './ui';
import { ScriptBindingsSchema, scriptBindingRules } from './scripts';
import { RowsSchema } from './rows';

const natural = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const positive = v.pipe(natural, v.minValue(1));
const finite = v.pipe(v.number(), v.finite());
const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const ref = v.pipe(v.string(), v.regex(/^(?:commons:)?[a-f0-9]{64}$/u));
const vec3 = v.tuple([finite, finite, finite]);
const channel = v.pipe(finite, v.minValue(0), v.maxValue(1));
const colour = v.tuple([channel, channel, channel]);
const bounds = v.pipe(v.strictObject({ min: vec3, max: vec3 }), v.check((b) => b.min.every((n, i) => n <= (b.max[i] ?? -Infinity)), 'ordered bounds'), v.check((b) => b.min[0] >= -CHUNK_HALF && b.max[0] <= CHUNK_HALF && b.min[2] >= -CHUNK_HALF && b.max[2] <= CHUNK_HALF && b.min[1] >= -CELL_BELOW && b.max[1] <= CELL_ABOVE, 'cell bounds'));
const costs = { compressed: natural, decoded: natural, gpu: natural, triangles: natural, draws: natural };
const field = v.strictObject({ id: v.pipe(positive, v.maxValue(0x7fffffff)), name, type: v.picklist(['bool', 'i32', 'f64', 'string']), privacy: v.picklist(['public', 'owner', 'host']), default: v.union([v.boolean(), finite, v.string()]), min: v.optional(finite), max: v.optional(finite) });
const unsigned = v.pipe(finite, v.minValue(0));
const key = v.strictObject({ time: channel, sky: v.strictObject({ zenith: colour, horizon: colour }), fog: v.strictObject({ colour, density: unsigned, near: v.optional(unsigned), far: v.optional(unsigned) }), sun: v.strictObject({ colour, intensity: unsigned }), ambient: v.strictObject({ sky: colour, ground: colour, intensity: unsigned }) });
const day = v.strictObject({ minutes: v.pipe(finite, v.minValue(1), v.maxValue(1440)), start: channel, maxElevation: v.pipe(finite, v.minValue(0), v.maxValue(90)), azimuth: v.pipe(finite, v.minValue(-180), v.maxValue(180)) });
/** A colour LUT file's exact wire size: 33³ RGBA8 (the engine's render/lut format). */
export const LOOK_LUT_BYTES = 33 ** 3 * 4;
const edge = v.strictObject({ heights: v.pipe(v.array(v.pipe(finite, v.minValue(-CELL_BELOW), v.maxValue(CELL_ABOVE))), v.minLength(2), v.maxLength(129)), colours: v.pipe(v.array(colour), v.minLength(2), v.maxLength(129)), roadHeight: v.literal(0) });
const tile = v.strictObject({ lod: v.picklist([0, 1]), x: natural, z: natural, bounds, geometricError: v.pipe(finite, v.minValue(0)), files: v.array(ref), ...costs });
const file = v.strictObject({ hash, kind: v.picklist(['glb', 'ktx2', 'audio', 'json', 'wasm', 'binary']), ...costs, dependencies: v.array(ref), critical: v.boolean() });
const rawSchema = v.strictObject({
  version: v.literal(SHARDFILE_VERSION),
  identity: v.strictObject({ slug: name, name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), author: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), revision: positive, seed: natural }),
  requires: v.strictObject({ sdk: v.literal(0), capabilities: v.array(name), commons: v.array(hash) }),
  budgets: v.strictObject({ library: v.strictObject({ resident: v.pipe(natural, v.maxValue(CONTENT_CAPS.library.resident)), compressed: v.pipe(natural, v.maxValue(CONTENT_CAPS.library.compressed)) }), sim: v.strictObject({ resident: v.pipe(natural, v.maxValue(CONTENT_CAPS.sim.resident)), compressed: v.pipe(natural, v.maxValue(CONTENT_CAPS.sim.compressed)) }), overlap: v.pipe(natural, v.maxValue(CONTENT_CAPS.overlap)) }),
  look: v.strictObject({ families: v.array(name), grade: v.strictObject({ exposure: finite, saturation: v.pipe(finite, v.minValue(0)), contrast: v.pipe(finite, v.minValue(0)), lut: v.nullable(ref) }), clock: v.literal('engine'), day: v.optional(day), dayOverride: v.nullable(channel), keys: v.pipe(v.array(key), v.maxLength(64)) }),
  sim: v.strictObject({ fixedHz: v.literal(60), scriptTickDivisor: v.pipe(positive, v.check((n) => 60 % n === 0, 'script divisor divides 60')), commandVersion: v.literal(0), snapshotVersion: v.literal(0), scripts: v.array(ref), bindings: v.optional(ScriptBindingsSchema, []) }),
  state: v.strictObject({ version: positive, sharedOwner: v.literal('host'), playerKey: v.literal('actorId'), shared: v.array(field), player: v.array(field) }),
  authorCaps: v.strictObject({ players: v.pipe(positive, v.maxValue(32)), speed: v.pipe(finite, v.minValue(0), v.maxValue(15)) }),
  serverBudget: v.strictObject({ tickMicros: v.pipe(positive, v.maxValue(16_666)), memory: v.pipe(positive, v.maxValue(CONTENT_CAPS.sim.resident)), entities: v.pipe(natural, v.maxValue(10_000)), commandsPerTick: v.pipe(natural, v.maxValue(1024)) }),
  edge: v.strictObject({ north: edge, east: edge, south: edge, west: edge }),
  files: v.array(file), tiles: v.array(tile), library: v.array(ref), critical: v.array(ref),
  far: v.nullable(v.strictObject({ files: v.array(ref), bounds, ...costs })),
  ui: v.optional(UiSchema, []),
  rows: v.optional(RowsSchema, { strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [] }),
});
/** A serialisable shardfile v0, independent of renderer and placement. */
export type Shardfile = v.InferOutput<typeof rawSchema>;

/** Semantic format violations, including reference integrity and the acyclic dependency graph. */
export function shardfileRules(s: Shardfile): string[] {
  const errors: string[] = [];
  const files = new Map(s.files.map((f) => [f.hash, f]));
  if (files.size !== s.files.length) errors.push('unique file hashes');
  const refs = [...s.files.flatMap((f) => f.dependencies), ...s.tiles.flatMap((t) => t.files), ...s.library, ...s.critical, ...s.sim.scripts, ...(s.far?.files ?? []), ...(s.look.grade.lut === null ? [] : [s.look.grade.lut])];
  for (const r of refs) if (r.startsWith('commons:') ? !s.requires.commons.includes(r.slice(8)) : !files.has(r)) errors.push(`undeclared reference ${r}`);
  const visited = new Set<string>(), active = new Set<string>();
  const visit = (id: string): void => {
    if (active.has(id)) { errors.push('acyclic dependencies'); return; }
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    for (const d of files.get(id)?.dependencies ?? []) if (!d.startsWith('commons:')) visit(d);
    active.delete(id);
  };
  for (const id of files.keys()) visit(id);
  for (const list of [s.state.shared, s.state.player]) {
    if (new Set(list.map((f) => f.name)).size !== list.length) errors.push('unique state fields');
    for (const f of list) if (f.type === 'bool' ? typeof f.default !== 'boolean' : f.type === 'string' ? typeof f.default !== 'string' : typeof f.default !== 'number' || (f.type === 'i32' && (!Number.isInteger(f.default) || f.default < -2147483648 || f.default > 2147483647))) errors.push('typed state default');
  }
  const fields = [...s.state.shared, ...s.state.player];
  if (new Set(fields.map((f) => f.id)).size !== fields.length) errors.push('unique stable state ids');
  if (fields.filter((f) => f.type !== 'string').length > 24) errors.push('numeric script state capacity');
  for (const f of fields) {
    if (f.type === 'string') {
      if (f.min !== undefined || f.max !== undefined) errors.push('numeric state bounds only');
      continue;
    }
    const low = f.type === 'bool' ? 0 : f.type === 'i32' ? -2147483648 : -Number.MAX_VALUE;
    const high = f.type === 'bool' ? 1 : f.type === 'i32' ? 2147483647 : Number.MAX_VALUE;
    const min = f.min ?? low, max = f.max ?? high, value = typeof f.default === 'boolean' ? Number(f.default) : f.default;
    if (min < low || max > high || min > max || (f.type !== 'f64' && (!Number.isInteger(min) || !Number.isInteger(max))) || typeof value !== 'number' || value < min || value > max) errors.push('typed state bounds');
  }
  const lut = s.look.grade.lut === null || s.look.grade.lut.startsWith('commons:') ? null : files.get(s.look.grade.lut);
  if (lut !== undefined && lut !== null && (lut.kind !== 'binary' || lut.compressed !== LOOK_LUT_BYTES)) errors.push('look LUT is a 33³ RGBA8 binary file');
  if (s.look.keys.some((k, i) => i > 0 && k.time <= (s.look.keys[i - 1]?.time ?? Infinity))) errors.push('ordered day keys');
  const linearFog = s.look.keys[0]?.fog.near !== undefined;
  for (const { fog } of s.look.keys) if ((fog.near === undefined) !== (fog.far === undefined) || (fog.near !== undefined && fog.far !== undefined && (fog.near >= fog.far || fog.density !== 0)) || (fog.near !== undefined) !== linearFog) errors.push('consistent ordered linear fog bounds with zero density');
  for (const e of Object.values(s.edge)) if (e.heights.length !== e.colours.length) errors.push('edge sample lengths');
  const seen = new Set<string>();
  for (const t of s.tiles) {
    const id = `${t.lod}/${t.x}/${t.z}`, cap = t.lod === 0 ? CONTENT_CAPS.l0 : CONTENT_CAPS.l1;
    if (seen.has(id)) errors.push('unique tile addresses'); seen.add(id);
    const n = 500 / cap.size;
    if (t.x >= n || t.z >= n || t.bounds.min[0] !== -250 + t.x * cap.size || t.bounds.max[0] !== -250 + (t.x + 1) * cap.size || t.bounds.min[2] !== -250 + t.z * cap.size || t.bounds.max[2] !== -250 + (t.z + 1) * cap.size) errors.push('tile grid bounds');
    if (t.decoded + t.gpu > cap.resident || t.compressed > cap.compressed || t.triangles > cap.triangles || t.draws > cap.draws) errors.push('tile caps');
    if (t.lod === 1 && t.files.some((r) => s.library.includes(r))) errors.push('self-contained coarse tile');
  }
  if (s.far !== null && (s.far.decoded + s.far.gpu > CONTENT_CAPS.far.resident || s.far.compressed > CONTENT_CAPS.far.compressed || s.far.triangles > CONTENT_CAPS.far.triangles || s.far.draws > CONTENT_CAPS.far.draws)) errors.push('far caps');
  for (const f of s.files) if (f.critical !== s.critical.includes(f.hash)) errors.push('critical flags match roots');
  errors.push(...uiRules(s.ui, s.state));
  errors.push(...scriptBindingRules(s.sim.bindings, s.sim.scripts));
  if (new Set(s.sim.scripts).size !== s.sim.scripts.length) errors.push('unique script modules');
  if (s.sim.scripts.some((module) => !module.startsWith('commons:') && files.get(module)?.kind !== 'wasm')) errors.push('script module is a Wasm file');
  return [...new Set(errors)];
}
/** Strict schema for the public SDK format; rejects unknown fields and invalid references. */
export const ShardfileSchema = v.pipe(rawSchema, v.check((s) => shardfileRules(s).length === 0, 'shardfile semantic rules'));
/** Parse untrusted JSON as a validated shardfile, or throw a Valibot error. */
export function parseShardfile(input: unknown): Shardfile { return v.parse(ShardfileSchema, input); }
