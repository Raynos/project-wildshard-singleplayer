import * as v from 'valibot';
import { FAMILY_IDS, FamilyMaterialSchema, paintedTerrainTextureRefs, ToonLookSchema, PainterlyLookSchema, EmissiveLookSchema } from '@wildshard/engine/render/families/params';

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

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
/** Authored material IDs select bounded platform presets or validated material graph data, never shader source. */
export const MaterialsSchema = v.pipe(v.record(id, v.union([FamilyMaterialSchema, graphMaterial])), v.check((rows) => Object.keys(rows).length <= 256, 'bounded material catalogue'));
/** Optional per-shard family looks use the renderer-neutral engine schemas. */
export const FamilyLooksSchema = v.strictObject({ toon: v.exactOptional(ToonLookSchema), painterly: v.exactOptional(PainterlyLookSchema), emissive: v.exactOptional(EmissiveLookSchema) });
/** Resolve authored surface IDs or the four platform default material IDs. */
export function materialExists(materials: Readonly<Record<string, unknown>>, idValue: string): boolean {
  return Object.hasOwn(materials, idValue) || FAMILY_IDS.some((family) => family === idValue);
}
/** All texture inputs, including ground layers and emitter fields, enter the admitted library closure. */
export function materialTextureRefs(materials: Readonly<v.InferOutput<typeof MaterialsSchema>>): string[] {
  return Object.values(materials).flatMap((material) => {
    if (material.family === 'graph') return Object.values(material.graph.params ?? {}).flatMap((param) => param.type === 'texture' && typeof param.value === 'string' ? [param.value] : []);
    if (material.family === 'toon') return [];
    if (material.family === 'pbr') return [...Object.values(material.maps), material.ground?.grain.map, material.ground?.trail?.map, material.ground?.keyShadow?.map].filter((ref): ref is string => typeof ref === 'string');
    if (material.family === 'painterly') return (material.map === null ? [] : [material.map]).concat(material.terrain === undefined ? [] : paintedTerrainTextureRefs(material.terrain));
    return [material.map, material.tube?.field, ...(material.sky?.maps ?? [])].filter((ref): ref is string => typeof ref === 'string');
  });
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

/** Check graph uniform bindings against admitted day channels and public numeric state declarations. */
export function materialGraphRules(source: Pick<Shardfile, 'look' | 'state'>): string[] {
  const errors: string[] = [];
  const { day: dayChannels, state: stateFields } = graphBindingSources(source);
  for (const [materialId, material] of Object.entries(source.look.materials)) {
    if (material.family !== 'graph') continue;
    const checked = validateGraph(material.graph, { dayKeys: [...dayChannels.keys()], stateFields });
    if (!checked.ok) errors.push(...checked.errors.map((error) => `material ${materialId}: ${error}`));
    for (const param of Object.values(material.graph.params ?? {})) {
      if (param.bind === undefined) continue;
      if ('state' in param.bind && param.type !== 'float') errors.push(`material ${materialId}: state binding requires a float param`);
      if ('day' in param.bind) {
        const type = dayChannels.get(param.bind.day);
        if (type !== undefined && (type === 'float' ? param.type !== 'float' : param.type !== 'vec3' && param.type !== 'colour')) errors.push(`material ${materialId}: day binding type must match its channel`);
      }
    }
  }
  return errors;
}
