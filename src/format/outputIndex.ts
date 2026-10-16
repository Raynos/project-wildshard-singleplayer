/** Versioned, renderer-free disk contract shared by the writer and network reader. */
import * as v from 'valibot';
import { ShardfileFieldSchemas, parseShardfile, type Shardfile } from './shardSchema';
import { RuntimeSchema } from './runtime';
import { RuntimeSpawnsSchema } from './runtimeSpawns';
import { RowsSchema } from './rows';
import { ShardHashSchema, ShardNaturalSchema, IdentitySchema, RequiresSchema, FilesSchema } from './shardSections';
import { SHARDFILE_VERSION } from './version';
import { isJsonData } from './json';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';

const path = v.pipe(v.string(), v.maxLength(240), v.regex(/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/u));
const sectionName = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9-]*\/[a-z][a-zA-Z0-9-]*$/u));
const measuredFile = { path, hash: ShardHashSchema, bytes: ShardNaturalSchema };
const section = v.strictObject({ ...measuredFile, name: sectionName, schema: v.pipe(v.string(), v.maxLength(240)), audience: v.picklist(['sim', 'client', 'both']), load: v.picklist(['boot', 'enter', 'stream']) });
const costs = v.omit(FilesSchema.pipe[0].item, ['kind']).entries;
const fileSchema = v.strictObject({ ...costs, path, kind: v.picklist(['glb', 'ktx2', 'audio', 'json', 'wasm', 'tile', 'bin', 'image']), name: v.exactOptional(v.pipe(v.string(), v.maxLength(240))), commons: v.exactOptional(v.literal(true)) });
const runtime = v.strictObject({ ...v.omit(RuntimeSchema.pipe[0], ['spawns']).entries, trust: v.literal('first-party'), files: v.array(v.strictObject({ ...measuredFile, lines: ShardNaturalSchema })), lines: ShardNaturalSchema });
/** Format 2 inventories every emitted byte except its index and validation receipt. */
export const OutputIndexSchema = v.strictObject({
  format: v.literal('wildshard.shardfile'), formatVersion: v.literal(2), sdk: v.literal('0.2'), version: v.literal(SHARDFILE_VERSION),
  identity: IdentitySchema, build: v.strictObject({ sourceHash: ShardHashSchema, validator: v.pipe(v.string(), v.minLength(1), v.maxLength(160)) }), requires: RequiresSchema,
  admission: v.strictObject({ budgets: ShardfileFieldSchemas.budgets, serverBudget: ShardfileFieldSchemas.serverBudget, authorCaps: ShardfileFieldSchemas.authorCaps, critical: ShardfileFieldSchemas.critical, library: ShardfileFieldSchemas.library }),
  sections: v.pipe(v.array(section), v.maxLength(256)), schemas: v.pipe(v.array(v.strictObject(measuredFile)), v.maxLength(128)),
  files: v.pipe(v.array(fileSchema), v.maxLength(8192)), runtime: v.nullable(runtime),
});
export type OutputIndex = v.InferOutput<typeof OutputIndexSchema>;
export type OutputFile = OutputIndex['files'][number];
export type OutputSection = OutputIndex['sections'][number];
interface SectionMapping { readonly name: string; readonly fields: readonly (keyof Shardfile)[]; readonly row?: keyof Shardfile['rows']; readonly spawns?: true; readonly audience: OutputSection['audience']; readonly load: OutputSection['load'] }
/** Root-key envelopes preserve optional-field absence and every existing host's values. */
export const OUTPUT_SECTIONS: readonly SectionMapping[] = [
  {name:'world/tiles',fields:['tiles','far','near'],audience:'both',load:'stream'},
  {name:'world/terrain',fields:['terrain','nativeGround'],audience:'both',load:'boot'},
  {name:'world/edge',fields:['edge','entryways'],audience:'both',load:'boot'},
  {name:'world/collision',fields:['meshCollision'],audience:'both',load:'enter'},
  {name:'world/navigation',fields:['navigation'],audience:'both',load:'enter'},
  {name:'world/props',fields:['props'],audience:'both',load:'enter'},
  {name:'world/water',fields:['water'],audience:'both',load:'enter'},
  {name:'world/movers',fields:['movers'],audience:'both',load:'enter'},
  {name:'world/traversal',fields:['traversal'],audience:'both',load:'enter'},
  {name:'world/spawn',fields:['spawn'],audience:'both',load:'boot'},
  {name:'look/look',fields:['look','presentation'],audience:'client',load:'enter'},
  {name:'look/map',fields:['map'],audience:'client',load:'enter'},
  {name:'actors/creatures',fields:['creatures'],audience:'both',load:'enter'},
  {name:'actors/crowds',fields:['crowds'],audience:'both',load:'enter'},
  {name:'actors/npcs',fields:['questNpcs'],audience:'both',load:'enter'},
  {name:'actors/spawns',fields:[],spawns:true,audience:'both',load:'enter'},
  {name:'combat/items',fields:['items'],audience:'both',load:'enter'},
  {name:'combat/encounters',fields:['encounters'],audience:'both',load:'enter'},
  {name:'quests/quests',fields:['quests'],audience:'both',load:'enter'},
  {name:'quests/host',fields:['questHost'],audience:'both',load:'enter'},
  {name:'quests/directors',fields:['directors'],audience:'both',load:'enter'},
  {name:'economy/ledger',fields:['ledger'],audience:'both',load:'enter'},
  {name:'state/state',fields:['state'],audience:'both',load:'boot'},
  {name:'state/migrations',fields:['migrations'],audience:'both',load:'boot'},
  {name:'state/modes',fields:['modes'],audience:'both',load:'enter'},
  {name:'sim/sim',fields:['sim'],audience:'both',load:'boot'},
  {name:'sim/hooks',fields:['hooks'],audience:'both',load:'enter'},
  {name:'sim/client-scripts',fields:['clientScripts'],audience:'client',load:'enter'},
  {name:'sim/client-channels',fields:['clientChannels'],audience:'client',load:'enter'},
  {name:'sim/plumbing',fields:['plumbing'],audience:'client',load:'enter'},
  {name:'audio/audio',fields:['audio'],audience:'client',load:'enter'},
  {name:'ui/card',fields:['accent','manifest'],audience:'client',load:'boot'},
  {name:'ui/ui',fields:['ui','targets'],audience:'client',load:'enter'},
  ...(['species','strikes','loot','days','weather','looks','compendiums'] as const).map(row => ({name:({species:'actors/species',strikes:'combat/strikes',loot:'economy/loot',days:'world/days',weather:'world/weather',looks:'look/materials',compendiums:'ui/compendium'})[row],fields:[],row,audience:'both' as const,load:'enter' as const})),
];
/** Detect the explicit disk envelope, including unsupported versions that must refuse. */
export function isOutputIndex(input: unknown): boolean { return typeof input === 'object' && input !== null && 'format' in input && input.format === 'wildshard.shardfile'; }
/** Parse the supported major and refuse duplicate, escaping or noncanonical inventory paths. */
export function parseOutputIndex(input: unknown): OutputIndex {
  if (!isJsonData(input)) throw new Error('Output index must contain plain JSON only');
  const index = v.parse(OutputIndexSchema, input), paths = new Set(['shard.json', 'validation.json']), names = new Set<string>();
  if (index.sections.reduce((total, entry) => total + entry.bytes, 0) > limits.sourceBytes) throw new Error('Output sections exceed the source byte cap');
  for (const entry of [...index.sections, ...index.schemas, ...index.files, ...index.runtime?.files ?? []]) {
    if (entry.path.split('/').some(part => part === '.' || part === '..') || paths.has(entry.path)) throw new Error('Duplicate or escaping output path');
    paths.add(entry.path);
  }
  for (const entry of index.sections) {
    if (names.has(entry.name) || entry.path !== `sections/${entry.name}.json`) throw new Error('Duplicate or mismatched section path');
    names.add(entry.name);
    if (entry.name.startsWith('custom/')) {
      if (entry.schema !== `schemas/${entry.name}.schema.json` || !index.schemas.some(row => row.path === entry.schema)) throw new Error('Custom section needs its listed schema');
    } else if (!OUTPUT_SECTIONS.some(row => row.name === entry.name) || entry.schema !== `wildshard:${entry.name}@1`) throw new Error('Unknown platform section schema');
  }
  for (const entry of index.schemas) if (!index.sections.some(row => row.schema === entry.path)) throw new Error('Unreferenced custom schema');
  const refs = new Set<string>(), logical = new Set<string>();
  for (const entry of index.files) {
    outputBlobPath(entry);
    const ref = `${entry.commons === true ? 'commons:' : ''}${entry.hash}`;
    if (refs.has(ref)) throw new Error('Duplicate output blob reference'); refs.add(ref);
    if (entry.name !== undefined) { if (logical.has(entry.name)) throw new Error('Duplicate logical blob name'); logical.add(entry.name); }
  }
  for (const entry of index.runtime?.files ?? []) if (!/^runtime\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/u.test(entry.path)) throw new Error('Runtime output must be TypeScript inside runtime/');
  return index;
}
/** Validated relative blob path, independent of a server base URL. */
export function outputBlobPath(file: Pick<OutputFile, 'kind' | 'hash' | 'path'>): string {
  const extensions: Record<OutputFile['kind'], readonly string[]> = { glb: ['glb'], ktx2: ['ktx2'], tile: ['wtt'], bin: ['bin'], json: ['json'], wasm: ['wasm'], image: ['webp', 'jpg', 'png'], audio: ['mp3', 'ogg', 'wav', 'm4a'] };
  if (!extensions[file.kind].some(ext => file.path === `blobs/${file.kind}/${file.hash}.${ext}`)) throw new Error('Blob path differs from its kind and hash');
  return file.path;
}
/** Deterministic platform section values; custom author sections are added separately. */
export function outputSectionPayloads(source: Shardfile): ReadonlyMap<string, unknown> {
  const result = new Map<string, unknown>();
  for (const mapping of OUTPUT_SECTIONS) {
    const payload: Record<string, unknown> = {};
    for (const field of mapping.fields) if (Object.hasOwn(source, field)) payload[field] = source[field];
    if (mapping.row !== undefined) payload['rows'] = {[mapping.row]: source.rows[mapping.row]};
    if (mapping.spawns === true && source.runtime?.spawns !== undefined) payload['runtime'] = {spawns:source.runtime.spawns};
    if (Object.keys(payload).length > 0) result.set(mapping.name, payload);
  }
  return result;
}
/** Check each platform section against the same defining field schemas as the monolith. */
export function parseOutputSection(name: string, input: unknown): Record<string, unknown> {
  const mapping = OUTPUT_SECTIONS.find(row => row.name === name);
  if (mapping === undefined) throw new Error('Unknown platform section');
  if (!isJsonData(input) || typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Section must contain JSON fields');
  const expected = mapping.row !== undefined ? ['rows'] : mapping.spawns === true ? ['runtime'] : mapping.fields;
  if (Object.keys(input).some(key => !expected.includes(key as keyof Shardfile))) throw new Error('Section contains an undeclared field');
  for (const field of mapping.fields) if (Object.hasOwn(input, field)) v.parse(ShardfileFieldSchemas[field], Reflect.get(input, field));
  if (mapping.row !== undefined) {
    const row = v.parse(v.strictObject({[mapping.row]: RowsSchema.pipe[2].entries[mapping.row]}), Reflect.get(input, 'rows'));
    return {rows:row};
  }
  if (mapping.spawns === true) return {runtime:v.parse(v.strictObject({spawns:RuntimeSpawnsSchema}),Reflect.get(input,'runtime'))};
  return Object.fromEntries(Object.entries(input));
}
/** Reconstruct the unchanged admitted host model; no transport metadata leaks into it. */
export function assembleOutputShardfile(input: unknown, sections: ReadonlyMap<string, unknown>): Shardfile {
  const index = parseOutputIndex(input), result: Record<string, unknown> = {version:index.version,identity:index.identity,requires:index.requires,...index.admission,files:index.files.filter(file => file.commons !== true).map(({path: _path,name: _name,commons: _commons,kind,...rest}) => Object.assign(rest,{kind:kind === 'tile' || kind === 'bin' ? 'binary' : kind})),runtime:index.runtime === null ? null : {entry:index.runtime.entry,...(index.runtime.cost === undefined ? {} : {cost:index.runtime.cost}),...(index.runtime.binds === undefined ? {} : {binds:index.runtime.binds})}};
  if (sections.size !== index.sections.length || index.sections.some(entry => !sections.has(entry.name))) throw new Error('Missing or surplus output section');
  const rows: Record<string, unknown> = {};
  for (const entry of index.sections) {
    if (entry.name.startsWith('custom/')) continue;
    const value = parseOutputSection(entry.name, sections.get(entry.name));
    for (const [key, data] of Object.entries(value)) {
      if (key === 'rows') Object.assign(rows,data);
      else if (key === 'runtime') Object.assign(result['runtime'] ?? {},data);
      else if (Object.hasOwn(result,key)) throw new Error('Overlapping output section'); else result[key] = data;
    }
  }
  result['rows'] = rows;
  return parseShardfile(result);
}
