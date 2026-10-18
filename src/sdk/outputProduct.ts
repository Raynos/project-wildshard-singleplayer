/** Author-only format-2 emission and on-disk inventory validation. */
// oxlint-disable-next-line import/no-nodejs-modules -- The author CLI owns its explicit product output directory.
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Product paths are validated relative paths, never URLs.
import { dirname, resolve } from 'node:path';
import { assembleOutputShardfile, outputSectionPayloads, OUTPUT_SECTIONS, parseOutputIndex, parseOutputSection, validateOutputSection, type OutputFile, type OutputIndex } from '@wildshard/format/outputIndex';
import { decisionModuleContracts, decisionScriptsFromSections, scriptAdmissionRows, type ScriptContract } from '@wildshard/format/scriptContract';
import type { DecisionScripts } from '@wildshard/format/decisionScripts';
import { parseWorldTargets, worldTargetRules } from '@wildshard/format/worldTargets';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { structuralGridEvidence } from '@wildshard/format/gridReadiness';
import { assetCost, offlineMemoryAdmission, validationRevision, validationSourceBytes } from '@wildshard/format/product';
import { preflightDeclaredCosts } from '@wildshard/format/assetAdmission';
import { isTerrainTileData } from '@wildshard/format/terrainTileBytes';
import { parseImageAsset } from '@wildshard/format/stillImage';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '@wildshard/format/admissionLimits';
import { admitProduct } from './productOutput';
import { performanceTargetIssues } from './reportCard';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { readBoundedFile } from './sourceReader';
import { validateRuntimeImports } from './runtimeImports';
import { validateDefinedSection, type EmittedSections } from './sections';

const encoder = new TextEncoder();
function jsonBytes(value: unknown): Uint8Array { return encoder.encode(encodeCanonicalJson(value)); }
function readJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder('utf-8', {fatal:true}).decode(bytes), value: unknown = JSON.parse(text);
  if (encodeCanonicalJson(value) !== text) throw new Error('Output JSON must use canonical encoding');
  return value;
}
function blobKind(kind: string, bytes: Uint8Array): OutputFile['kind'] {
  if (kind === 'binary') return isTerrainTileData(bytes) ? 'tile' : 'bin';
  if (kind === 'commons') {
    const head = new TextDecoder().decode(bytes.subarray(0, 4));
    if (head === 'glTF') return 'glb'; if (bytes[0] === 171) return 'ktx2';
    if (head === 'RIFF' || new TextDecoder().decode(bytes.subarray(4,8)) === 'ftyp') return 'audio';
    return isTerrainTileData(bytes) ? 'tile' : 'bin';
  }
  if (kind === 'glb' || kind === 'ktx2' || kind === 'audio' || kind === 'json' || kind === 'wasm' || kind === 'image') return kind;
  throw new Error('Unsupported output asset kind');
}
function blobExtension(kind: OutputFile['kind'], bytes: Uint8Array): string {
  if (kind === 'tile') return 'wtt';
  if (kind === 'image') return {'image/webp':'webp','image/jpeg':'jpg','image/png':'png'}[parseImageAsset(bytes).mime];
  if (kind === 'audio') {
    const head = new TextDecoder().decode(bytes.subarray(0,4));
    if (head === 'RIFF') return 'wav'; if (head === 'OggS') return 'ogg';
    if (new TextDecoder().decode(bytes.subarray(4,8)) === 'ftyp') return 'm4a';
    return 'mp3';
  }
  return kind;
}
function inspectBlob(file: OutputFile, bytes: Uint8Array, script?: ScriptContract): void {
  const legacy = file.kind === 'bin' || file.kind === 'tile' ? 'binary' : file.kind;
  if (blobKind(legacy,bytes) !== file.kind || !file.path.endsWith(`.${blobExtension(file.kind,bytes)}`)) throw new Error('Output blob bytes differ from their declared kind');
  const cost = assetCost(legacy,bytes,script);
  if ((['decoded','gpu','triangles','draws'] as const).some(key => cost[key] > file[key])) throw new Error('Output blob understates parsed costs');
}
function put(destination: string, path: string, bytes: Uint8Array): void { const target = resolve(destination,path); mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes); }
/** Optional build-only extensions. Runtime bytes themselves are written by the P3 copier. */
export interface OutputProductOptions {
  readonly custom?: EmittedSections;
  readonly platform?: EmittedSections;
  readonly namedFiles?: readonly OutputFile[];
  readonly runtime?: { readonly files: readonly NonNullable<OutputIndex['runtime']>['files'][number][]; readonly lines: number };
}
/** The platform sections a decision row resolves against: its rows and the moves they bind. */
export const DECISION_CONTEXT_SECTIONS = ['sim/scripts', 'actors/spawn-scripts', 'actors/return-scripts', 'actors/moves', 'world/targets'] as const;
/** Read the named canonical platform payloads, each only after checking its emitted hash and size. */
export function outputPlatformPayloads(platform: EmittedSections | undefined, names: readonly string[] = DECISION_CONTEXT_SECTIONS): ReadonlyMap<string, unknown> {
  const payloads = new Map<string, unknown>();
  for (const entry of platform?.sections ?? []) {
    if (!names.includes(entry.name)) continue;
    if (payloads.has(entry.name)) throw new Error(`Duplicate ${entry.name} section`);
    const bytes = platform?.files.get(entry.path);
    if (bytes === undefined || bytes.length !== entry.bytes || hashImmutableBytes(bytes) !== entry.hash) throw new Error(`${entry.name} section hash or size mismatch`);
    payloads.set(entry.name, readJson(bytes));
  }
  return payloads;
}
/** Read the canonical platform decision payload only after checking its emitted hash and size. */
export function outputDecisionScripts(platform?: EmittedSections): DecisionScripts {
  return decisionScriptsFromSections(outputPlatformPayloads(platform, ['sim/scripts']));
}
/** Exact contracts for both generic actor decisions and population-owned directors. */
export function outputScriptAdmissionRows(platform?: EmittedSections): DecisionScripts {
  return scriptAdmissionRows(outputPlatformPayloads(platform, ['sim/scripts', 'actors/spawn-scripts', 'actors/return-scripts']));
}
function checkWorldTargets(source: Shardfile, input: unknown): void {
  if (input === undefined) return;
  const errors = worldTargetRules(parseWorldTargets(input), source);
  if (errors.length > 0) throw new Error(errors.join('; '));
}
/** Split an admitted product without changing host values or any immutable asset byte. */
export function writeOutputProduct(input: unknown, assets: ReadonlyMap<string,Uint8Array>, destination: string, options: OutputProductOptions = {}): OutputIndex {
  const scripts = outputScriptAdmissionRows(options.platform), source = admitProduct(input,assets,'warn',scripts);
  const targetEntry = options.platform?.sections.find(row => row.name === 'world/targets');
  if (targetEntry !== undefined) {
    const bytes = options.platform?.files.get(targetEntry.path);
    if (bytes === undefined || bytes.length !== targetEntry.bytes || hashImmutableBytes(bytes) !== targetEntry.hash) throw new Error('World target section hash or size mismatch');
    checkWorldTargets(source, readJson(bytes));
  }
  for(const issue of performanceTargetIssues(source,'warn'))console.warn(`Output budget report-only (G453): ${issue.metric}: ${issue.actual} exceeds ${issue.limit}`);
  source.files.sort((a,b)=>a.hash.localeCompare(b.hash));
  source.tiles.sort((a,b)=>a.lod-b.lod||a.x-b.x||a.z-b.z);
  const sections: OutputIndex['sections'] = [], schemas: OutputIndex['schemas'] = [], files: OutputIndex['files'] = [];
  const emitted = new Map<string,Uint8Array>();
  for (const [name,value] of outputSectionPayloads(source)) {
    const mapping = OUTPUT_SECTIONS.find(row => row.name === name); if (mapping === undefined) throw new Error('Missing platform section mapping');
    parseOutputSection(name,value);
    const bytes = jsonBytes(value), path = `sections/${name}.json`;emitted.set(path,bytes);
    sections.push({name,path,schema:`wildshard:${name}@1`,hash:hashImmutableBytes(bytes),bytes:bytes.length});
  }
  for (const {name,path,schema,hash,bytes} of [...options.custom?.sections ?? [],...options.platform?.sections ?? []]) sections.push({name,path,schema,hash,bytes});
  for (const [path,bytes] of [...options.custom?.files ?? [],...options.platform?.files ?? []]) {
    if (emitted.has(path)) throw new Error('Custom output crosses platform output');
    emitted.set(path,bytes);
    if (path.startsWith('schemas/')) schemas.push({path,hash:hashImmutableBytes(bytes),bytes:bytes.length});
  }
  const declarations = new Map(source.files.map(file => [file.hash,file]));
  const names=new Map<string,OutputFile>();
  for(const file of options.namedFiles??[]){if(names.has(file.hash))throw new Error('Duplicate named blob reference');names.set(file.hash,file);}
  for (const [reference,bytes] of assets) {
    const commons = reference.startsWith('commons:'), hash = commons ? reference.slice(8) : reference;
    if(commons&&declarations.has(hash))continue;
    const declaration = declarations.get(hash), pinned = source.requires.commonsCosts[hash];
    if (!commons && declaration === undefined) throw new Error('Unlisted output asset');
    if (commons && (pinned === undefined || !source.requires.commons.includes(hash))) throw new Error('Unlisted output commons asset');
    const kind = blobKind(commons ? 'commons' : declaration?.kind ?? '',bytes), path = `blobs/${kind}/${hash}.${blobExtension(kind,bytes)}`;
    if (emitted.has(path)) throw new Error('Output asset path collision');
    emitted.set(path,bytes);
    files.push({hash,kind,path,compressed:bytes.length,decoded:declaration?.decoded ?? pinned?.decoded ?? 0,gpu:declaration?.gpu ?? pinned?.gpu ?? 0,triangles:declaration?.triangles ?? pinned?.triangles ?? 0,draws:declaration?.draws ?? pinned?.draws ?? 0,dependencies:commons ? [] : declaration?.dependencies ?? [],critical:commons ? false : declaration?.critical ?? false,...(commons ? {commons:true as const} : {})});
  }
  for(const file of files){const named=names.get(file.hash);if(named!==undefined){const {name,...metadata}=named;if(encodeCanonicalJson(metadata)!==encodeCanonicalJson(file))throw new Error('Named blob differs from its admitted declaration');if(name!==undefined)file.name=name;names.delete(file.hash);}}
  if(names.size>0)throw new Error('Unadmitted named blob');
  const {spawns:_spawns,...runtime} = source.runtime ?? {};
  const index = parseOutputIndex({format:'wildshard.shardfile',formatVersion:2,sdk:'0.2',version:source.version,identity:source.identity,requires:source.requires,
    build:{sourceHash:hashImmutableBytes(jsonBytes(source)),validator:validationRevision() ?? 'source'},admission:{budgets:source.budgets,serverBudget:source.serverBudget,authorCaps:source.authorCaps,critical:source.critical,library:source.library},
    sections:sections.sort((a,b)=>a.name.localeCompare(b.name)),schemas:schemas.sort((a,b)=>a.path.localeCompare(b.path)),files:files.sort((a,b)=>a.hash.localeCompare(b.hash)||a.path.localeCompare(b.path)),runtime:source.runtime === null ? null : {...runtime,trust:'first-party',files:options.runtime?.files ?? [],lines:options.runtime?.lines ?? 0}});
  // A writer owns this product directory, never a source folder. Preserve only the
  // already-copied runtime files; refuse unrelated leftovers in validation below.
  mkdirSync(destination,{recursive:true});
  for (const [path,bytes] of emitted) put(destination,path,bytes);
  put(destination,'shard.json',jsonBytes(index));
  validateOutputProduct(destination);
  const cost = preflightDeclaredCosts(source,offlineMemoryAdmission('warn')).worst;
  put(destination,'validation.json',jsonBytes({revision:index.build.validator,sourceHash:hashImmutableBytes(validationSourceBytes(source)),indexHash:hashImmutableBytes(jsonBytes(index)),worst:cost,gridReady:structuralGridEvidence(source)}));
  return index;
}
/** Validate format, exact file inventory, bytes/kinds and platform/custom schemas.
 * Existing full product admission still enforces cross-references and budgets. */
export function validateOutputProduct(destination: string): {index:OutputIndex; shard:Shardfile; assets:ReadonlyMap<string,Uint8Array>} {
  const index = parseOutputIndex(readJson(readBoundedFile(resolve(destination,'shard.json'),limits.sourceBytes)));
  const listed = new Set(['shard.json','validation.json']), payloads = new Map<string,unknown>(), schemaBytes = new Map<string,Uint8Array>(), assets = new Map<string,Uint8Array>();
  const read = (entry:{path:string;hash:string;bytes:number}):Uint8Array => {
    let target=destination;
    for(const part of entry.path.split('/')){target=resolve(target,part);if(lstatSync(target).isSymbolicLink())throw new Error('Output symlinks refuse');}
    if(!lstatSync(target).isFile())throw new Error('Output inventory needs regular files');
    listed.add(entry.path);const bytes=readBoundedFile(resolve(destination,entry.path),entry.bytes);
    if(bytes.length!==entry.bytes||hashImmutableBytes(bytes)!==entry.hash)throw new Error(`Output hash or size mismatch: ${entry.path}`);return bytes;
  };
  for(const entry of index.schemas){const bytes=read(entry);readJson(bytes);schemaBytes.set(entry.path,bytes);}
  for(const entry of index.sections){const bytes=read(entry),value=readJson(bytes);if(entry.name.startsWith('custom/')){const schema=schemaBytes.get(entry.schema);if(schema===undefined)throw new Error('Missing custom schema');validateDefinedSection(schema,value);}else validateOutputSection(entry.name,value);payloads.set(entry.name,value);}
  const scripts = scriptAdmissionRows(payloads), contracts = decisionModuleContracts(scripts, index.files);
  for(const entry of index.files){const bytes=read({path:entry.path,hash:entry.hash,bytes:entry.compressed});inspectBlob(entry,bytes,entry.kind === 'wasm' ? contracts.get(entry.hash) ?? {abi:0} : undefined);assets.set(`${entry.commons===true?'commons:':''}${entry.hash}`,bytes);if(index.requires.commons.includes(entry.hash))assets.set(`commons:${entry.hash}`,bytes);}
  for(const entry of index.runtime?.files??[])validateRuntimeImports(destination,entry.path,new TextDecoder('utf-8',{fatal:true}).decode(read(entry)));
  const walk=(folder:string):void=>{for(const name of readdirSync(resolve(destination,folder))){const path=folder===''?name:`${folder}/${name}`,stat=lstatSync(resolve(destination,path));if(stat.isDirectory())walk(path);else if(!stat.isFile()||!listed.has(path))throw new Error(`Unlisted output file: ${path}`);}};
  walk('');
  const shard=admitProduct(assembleOutputShardfile(index,payloads),assets,'warn',scripts);
  checkWorldTargets(shard, payloads.get('world/targets'));
  if(hashImmutableBytes(jsonBytes(shard))!==index.build.sourceHash)throw new Error('Output sections differ from the declared source hash');
  return{index,shard,assets};
}
/** Clear only a caller-owned generated product before a fresh emission. */
export function clearOutputProduct(destination: string): void { if(existsSync(destination))rmSync(destination,{recursive:true,force:true}); }
