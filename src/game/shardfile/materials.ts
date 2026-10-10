import * as v from 'valibot';
import {
  FAMILY_IDS, FamilyMaterialSchema, GRAPH_PRESET_VERSION, paintedTerrainTextureRefs, parseEmissiveLook, parsePainterlyLook, parseToonLook, presetRefusal,
  ToonLookSchema, PainterlyLookSchema, EmissiveLookSchema, type EmissiveLookParams, type FamilyMaterialParams, type PainterlyLookParams, type ToonLookParams,
} from '@wildshard/engine/render/families/params';

import { validateGraph, type GraphIr } from '@wildshard/engine/core/materialGraph';
import { isJsonData } from './json';
import type { Shardfile } from './schema';

const graph = v.pipe(v.unknown(), v.rawTransform(({ dataset, addIssue, NEVER }): GraphIr => {
  if (!isJsonData(dataset.value)) { addIssue({ message: 'material graph is plain JSON data' }); return NEVER; }
  const checked = validateGraph(dataset.value);
  if (!checked.ok) { addIssue({ message: checked.errors.join('; ') }); return NEVER; }
  if (checked.graph.kind !== 'material') { addIssue({ message: 'material slot requires a material graph, not a post pass' }); return NEVER; }
  return checked.graph;
}));
const graphMaterial = v.strictObject({ family: v.literal('graph'), graph });
/** a graph file: a JSON file of the product's library closure holding one material graph (validated with its bytes) */
const graphFile = v.strictObject({ family: v.literal('graph'), file: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)) });
/** an engine-owned built-in preset: a family entry the engine re-expresses as graph IR (`familyPresetGraph`) */
const graphPreset = v.strictObject({ family: v.literal('graph'), preset: FamilyMaterialSchema, version: v.literal(GRAPH_PRESET_VERSION) });

/** a graph file's byte cap: the inline slot's raw JSON bound (`GRAPH_ADMISSION_LIMITS.bytes`) */
const GRAPH_FILE_BYTES = 64_000;
const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
/** Authored material IDs select bounded platform presets or validated material graph data, never shader source. */
export const MaterialsSchema = v.pipe(v.record(id, v.union([FamilyMaterialSchema, graphMaterial, graphFile, graphPreset])), v.check((rows) => Object.keys(rows).length <= 256, 'bounded material catalogue'));
/** An admitted catalogue entry. */
export type MaterialEntry = v.InferOutput<typeof MaterialsSchema>[string];
/** An admitted graph entry: inline IR, a graph file of the library closure or a built-in preset reference. */
export type GraphMaterialRef = Extract<MaterialEntry, { family: 'graph' }>;

/** The family looks a preset reads: the shard's own, defaults filled. */
export function presetLooks(familyLooks: Shardfile['look']['familyLooks']): { toon: ToonLookParams; painterly: PainterlyLookParams; emissive: EmissiveLookParams } {
  return { toon: parseToonLook(familyLooks.toon ?? {}), painterly: parsePainterlyLook(familyLooks.painterly ?? {}), emissive: parseEmissiveLook(familyLooks.emissive ?? {}) };
}
/**
 * A graph file's JSON (SF59): `file` returns an admitted file's bytes (undefined: not present). Throws when the file is
 * missing, past the inline slot's byte bound, or not UTF-8 JSON; the graph itself is validated by the caller under the
 * author caps (a graph file is authored content, never a trusted preset).
 */
export function graphFileJson(hash: string, file: (hash: string) => Uint8Array | undefined): unknown {
  const bytes = file(hash);
  if (bytes === undefined) throw new Error(`material graph file ${hash} is not an admitted file`);
  if (bytes.length > GRAPH_FILE_BYTES) throw new Error(`material graph file ${hash}: ${bytes.length} bytes (at most ${GRAPH_FILE_BYTES})`);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new Error(`material graph file ${hash} is not UTF-8 JSON`); }
}
/** The texture params of the catalogue's graph files (their bytes from `bytes`; a missing or unreadable file names none). */
export function graphFileTextureRefs(materials: Readonly<v.InferOutput<typeof MaterialsSchema>>, bytes: (hash: string) => Uint8Array | undefined): string[] {
  const refs: string[] = [];
  for (const material of Object.values(materials)) {
    if (material.family !== 'graph' || !('file' in material)) continue;
    const data = bytes(material.file);
    if (data === undefined) continue;
    // admission validated the file (graphFileRules); here only its texture params are read
    const json = graphFileJson(material.file, () => data);
    const params: unknown = typeof json === 'object' && json !== null ? Reflect.get(json, 'params') : undefined;
    if (typeof params !== 'object' || params === null) continue;
    for (const param of Object.values(params)) {
      if (typeof param === 'object' && param !== null && Reflect.get(param, 'type') === 'texture') { const value: unknown = Reflect.get(param, 'value'); if (typeof value === 'string') refs.push(value); }
    }
  }
  return refs;
}
/** Optional per-shard family looks use the renderer-neutral engine schemas. */
export const FamilyLooksSchema = v.strictObject({ toon: v.exactOptional(ToonLookSchema), painterly: v.exactOptional(PainterlyLookSchema), emissive: v.exactOptional(EmissiveLookSchema) });
/** Resolve authored surface IDs or the four platform default material IDs. */
export function materialExists(materials: Readonly<Record<string, unknown>>, idValue: string): boolean {
  return Object.hasOwn(materials, idValue) || FAMILY_IDS.some((family) => family === idValue);
}
/** All texture inputs, including ground layers and emitter fields, enter the admitted library closure. */
export function materialTextureRefs(materials: Readonly<v.InferOutput<typeof MaterialsSchema>>): string[] {
  return Object.values(materials).flatMap((material) => {
    if (material.family === 'graph') {
      // a preset's textures are its family entry's; a graph file's are its file row's dependencies (validated with its bytes)
      if ('preset' in material) return familyTextureRefs(material.preset);
      if ('file' in material) return [];
      return Object.values(material.graph.params ?? {}).flatMap((param) => param.type === 'texture' && typeof param.value === 'string' ? [param.value] : []);
    }
    return familyTextureRefs(material);
  });
}
function familyTextureRefs(material: FamilyMaterialParams): string[] {
  if (material.family === 'toon') return [];
  if (material.family === 'pbr') return [...Object.values(material.maps), material.ground?.grain.map, material.ground?.trail?.map, material.ground?.keyShadow?.map].filter((ref): ref is string => typeof ref === 'string');
  if (material.family === 'painterly') return (material.map === null ? [] : [material.map]).concat(material.terrain === undefined ? [] : paintedTerrainTextureRefs(material.terrain));
  return [material.map, material.tube?.field, ...(material.sky?.maps ?? [])].filter((ref): ref is string => typeof ref === 'string');
}

/** A graph binding's admitted sources: the day-key channels the look's keys carry (with their value type) and the public numeric state fields. */
export interface GraphBindingSources { readonly day: ReadonlyMap<string, 'float' | 'vec3'>; readonly state: readonly string[] }
/**
 * The admitted binding names of a shardfile (SF59): the canonical dotted day-key channels its look keys carry and its
 * declared public i32 / f64 state fields as `shared.<field>` / `player.<field>`. Admission and the client's compile both
 * use these lists, never a compiler default that allows any name.
 */
export function graphBindingSources(source: Pick<Shardfile, 'look' | 'state'>): GraphBindingSources {
  const day = new Map<string, 'float' | 'vec3'>();
  if (source.look.keys.length > 0) {
    for (const path of ['sky.zenith', 'sky.horizon', 'fog.colour', 'sun.colour', 'ambient.sky', 'ambient.ground']) day.set(path, 'vec3');
    for (const path of ['fog.density', 'sun.intensity', 'ambient.intensity']) day.set(path, 'float');
    if (source.look.keys.every((key) => key.fog.near !== undefined && key.fog.far !== undefined)) {
      day.set('fog.near', 'float'); day.set('fog.far', 'float');
    }
  }
  const state = ['shared', 'player'].flatMap((scope) => {
    const fields = scope === 'shared' ? source.state.shared : source.state.player;
    return fields.filter((field) => field.privacy === 'public' && (field.type === 'i32' || field.type === 'f64')).map((field) => `${scope}.${field.name}`);
  });
  return { day, state };
}

/**
 * Check graph uniform bindings against admitted day channels and public numeric state declarations. A preset reference
 * must be expressible as a built-in preset (`presetRefusal`, the rule the engine's preset door applies; the trusted preset
 * programs are held to `PRESET_GRAPH_BUDGET` by the engine's own tests, never the author caps); a graph file must be a
 * JSON file of the library closure (`files` / `library` given: its bytes are validated by product admission, `graphFileRules`).
 */
export function materialGraphRules(source: Pick<Shardfile, 'look' | 'state'> & Partial<Pick<Shardfile, 'files' | 'library'>>): string[] {
  const errors: string[] = [];
  const { day: dayChannels, state: stateFields } = graphBindingSources(source);
  const files = new Map((source.files ?? []).map((row) => [row.hash, row])), closure = new Set<string>(), pending = [...source.library ?? []];
  while (pending.length > 0) { const hash = pending.pop(); if (hash === undefined || closure.has(hash)) continue; closure.add(hash); pending.push(...files.get(hash)?.dependencies ?? []); }
  for (const [materialId, material] of Object.entries(source.look.materials)) {
    if (material.family !== 'graph') continue;
    if ('file' in material) {
      if (source.files !== undefined && (files.get(material.file)?.kind !== 'json' || !closure.has(material.file))) errors.push(`material ${materialId}: a graph file is a JSON file of the library closure`);
      continue;
    }
    if ('preset' in material) { const refusal = presetRefusal(material.preset); if (refusal !== null) errors.push(`material ${materialId}: ${refusal}`); continue; }
    const checked = validateGraph(material.graph, { dayKeys: [...dayChannels.keys()], stateFields });
    if (!checked.ok) { errors.push(...checked.errors.map((error) => `material ${materialId}: ${error}`)); continue; }
    errors.push(...bindingTypeErrors(materialId, checked.graph, dayChannels));
  }
  return errors;
}
/**
 * Product admission of the graph files a catalogue names (SF59): each file's bytes (`bytes(hash)`) are UTF-8 JSON of
 * one `kind: "material"` graph that validates under the author caps against the shard's admitted bindings, and every
 * texture param names a KTX2 file its row declares as a direct dependency (so the texture is charged with the closure).
 */
export function graphFileRules(source: Pick<Shardfile, 'look' | 'state' | 'files'>, bytes: (hash: string) => Uint8Array | undefined): string[] {
  const errors: string[] = [];
  const { day: dayChannels, state: stateFields } = graphBindingSources(source);
  const files = new Map(source.files.map((row) => [row.hash, row]));
  for (const [materialId, material] of Object.entries(source.look.materials)) {
    if (material.family !== 'graph' || !('file' in material)) continue;
    let ir: unknown;
    try { ir = graphFileJson(material.file, bytes); } catch (error) { errors.push(`material ${materialId}: ${error instanceof Error ? error.message : 'graph file'}`); continue; }
    const checked = validateGraph(ir, { dayKeys: [...dayChannels.keys()], stateFields });
    if (!checked.ok) { errors.push(...checked.errors.map((error) => `material ${materialId}: ${error}`)); continue; }
    if (checked.graph.kind !== 'material') { errors.push(`material ${materialId}: a graph file in a material slot holds a material graph, not a post pass`); continue; }
    const deps = new Set(files.get(material.file)?.dependencies);
    for (const param of Object.values(checked.graph.params ?? {})) {
      if (param.type === 'texture' && (typeof param.value !== 'string' || !deps.has(param.value) || files.get(param.value)?.kind !== 'ktx2')) errors.push(`material ${materialId}: a graph file's texture is a KTX2 dependency of its file row`);
    }
    errors.push(...bindingTypeErrors(materialId, checked.graph, dayChannels));
  }
  return errors;
}
function bindingTypeErrors(materialId: string, ir: GraphIr, dayChannels: ReadonlyMap<string, 'float' | 'vec3'>): string[] {
  const errors: string[] = [];
  for (const param of Object.values(ir.params ?? {})) {
    if (param.bind === undefined) continue;
    if ('state' in param.bind && param.type !== 'float') errors.push(`material ${materialId}: state binding requires a float param`);
    if ('day' in param.bind) {
      const type = dayChannels.get(param.bind.day);
      if (type !== undefined && (type === 'float' ? param.type !== 'float' : param.type !== 'vec3' && param.type !== 'colour')) errors.push(`material ${materialId}: day binding type must match its channel`);
    }
  }
  return errors;
}
