import { parseOutputIndex, validateOutputSection, assembleOutputShardfile, type OutputFile, type OutputIndex } from './outputIndex.ts';
import { decisionModuleContracts, scriptAdmissionRows, type ScriptAdmissionRows, type ScriptContract } from './scriptContract.ts';
import { registeredJsonContract, validateRegisteredJson } from './registeredJson.ts';
import { validatePlatformFile } from './platformFileFamilies.ts';
import { parseNamedJson } from './json.ts';
import { ktx2DeviceCosts } from './ktx2Cost.ts';
import { isTerrainTileData } from './terrainTileBytes.ts';
import { parseImageAsset } from './stillImage.ts';
import { parseWorldTargets, worldTargetRules } from './worldTargets.ts';
import { parseShardfile, type Shardfile } from './shardSchema.ts';
import { assetCost, offlineMemoryAdmission, performanceTargetIssues } from './product.ts';
import { preflightDeclaredCosts, validateShardfileAssets } from './assetAdmission.ts';
import { validationSourceBytes } from './validationReceipt.ts';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits.ts';

/**
 * P1-F3 format validation of a built shardfile product (format 2: `shard.json`, sections, blobs, packs): the schema,
 * the exact file inventory, hashes and sizes, byte kinds, declared costs, budgets and script admission rows. It needs
 * only this package. It never executes script bytes: re-running admitted WASM (G491) is the execution proof, which
 * stays with the author CLI and the cook worker.
 *
 * Call `prepareAssetDecoders()` (`@wildshard/format/product`) once before validating; GLB costs need the decoder.
 */

/** Read access to one product folder. Paths are `/`-separated and relative to the product root. */
export interface ProductFiles {
  /** The bytes of one regular file, refusing symlinks and anything larger than `maxBytes`. */
  readonly read: (path: string, maxBytes: number) => Uint8Array;
  /** Every non-directory entry under the root (symlinks and special files included, so they are refused as unlisted). */
  readonly paths: () => Iterable<string>;
}

/** The host services format validation needs but does not own. */
export interface ProductValidationPorts {
  /** Lowercase hex SHA-256 of exact bytes. */
  readonly hash: (bytes: Uint8Array) => string;
  /** Whether bytes have the expected hash; `whole` marks a complete inventory file a caller may remember. Default: `hash`. */
  readonly verify?: (bytes: Uint8Array, expected: string, whole: boolean) => boolean;
  /** Extra JSON Schema check of a named blob against its embedded `jsonSchema` (the author SDK runs Ajv). Registered names
   *  are always parsed by their defining format schema; an unregistered name with an embedded schema needs this port. */
  readonly definedJson?: (schemaBytes: Uint8Array, bytes: Uint8Array, name: string | undefined) => void;
  /** Import check for a copied `runtime/` file (the retired copied-runtime arm). Without it such files are refused. */
  readonly runtimeImports?: (path: string, source: string) => void;
}

/** A product that passed format validation. */
export interface ValidatedProduct {
  readonly index: OutputIndex;
  readonly shard: Shardfile;
  /** Admitted bytes by hash (`commons:<hash>` for pinned commons). */
  readonly assets: ReadonlyMap<string, Uint8Array>;
  /** The parsed section payloads by section name. */
  readonly sections: ReadonlyMap<string, unknown>;
  /** The script admission rows the product was admitted with. */
  readonly scripts: ScriptAdmissionRows;
}

const decoder = (): TextDecoder => new TextDecoder('utf-8', { fatal: true });

/** Parse canonical JSON bytes (sorted keys, one trailing newline), refusing any other encoding of the same value. */
export function readCanonicalJson(bytes: Uint8Array): unknown {
  const text = decoder().decode(bytes), value: unknown = JSON.parse(text);
  if (decoder().decode(validationSourceBytes(value)) !== text) throw new Error('Output JSON must use canonical encoding');
  return value;
}

/** The output kind of an asset's bytes, from its declared shardfile kind (`commons` sniffs the bytes). */
export function outputBlobKind(kind: string, bytes: Uint8Array): OutputFile['kind'] {
  if (kind === 'binary') return isTerrainTileData(bytes) ? 'tile' : 'bin';
  if (kind === 'commons') {
    const head = new TextDecoder().decode(bytes.subarray(0, 4));
    if (head === 'glTF') return 'glb'; if (bytes[0] === 171) return 'ktx2';
    if (head === 'RIFF' || new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp') return 'audio';
    return isTerrainTileData(bytes) ? 'tile' : 'bin';
  }
  if (kind === 'glb' || kind === 'ktx2' || kind === 'audio' || kind === 'json' || kind === 'wasm' || kind === 'image') return kind;
  throw new Error('Unsupported output asset kind');
}

/** The file extension an output blob of this kind and these bytes is written with. */
export function outputBlobExtension(kind: OutputFile['kind'], bytes: Uint8Array): string {
  if (kind === 'tile') return 'wtt';
  if (kind === 'image') return { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }[parseImageAsset(bytes).mime];
  if (kind === 'audio') {
    const head = new TextDecoder().decode(bytes.subarray(0, 4));
    if (head === 'RIFF') return 'wav'; if (head === 'OggS') return 'ogg';
    if (new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp') return 'm4a';
    return 'mp3';
  }
  return kind;
}

/** Refuse the declared targets a policy treats as refusals, before any byte is read or executed. */
export function assertProductTargets(source: Shardfile, policy: 'warn' | 'refuse'): void {
  const issues = performanceTargetIssues(source, policy).filter(issue => issue.severity === 'refusal');
  if (issues.length === 0) return;
  throw new Error(issues.map(issue => `REFUSAL: ${issue.metric}: ${issue.actual} > ${issue.limit}`).join('\n'));
}

/** Admit a whole shardfile's declared costs and its actual immutable bytes through the defining contracts. */
export function admitShardfileProduct(input: unknown, assets: ReadonlyMap<string, Uint8Array>, hash: (bytes: Uint8Array) => string,
  policy: 'warn' | 'refuse' = 'refuse', scripts: ScriptAdmissionRows = []): Shardfile {
  const source = parseShardfile(input);
  preflightDeclaredCosts(source, offlineMemoryAdmission(policy));
  assertProductTargets(source, policy);
  return validateShardfileAssets(source, assets, hash, offlineMemoryAdmission(policy), undefined, scripts);
}

/** Refuse world target rows that name items or quests the shardfile does not declare. */
export function checkWorldTargets(source: Shardfile, input: unknown): void {
  if (input === undefined) return;
  const errors = worldTargetRules(parseWorldTargets(input), source);
  if (errors.length > 0) throw new Error(errors.join('; '));
}

function inspectBlob(file: OutputFile, bytes: Uint8Array, ports: ProductValidationPorts, script?: ScriptContract): void {
  const contract = file.name === undefined ? undefined : registeredJsonContract(file.name);
  if (contract !== undefined && (file.kind !== 'json' || file.jsonSchema === undefined)) throw new Error('Registered JSON requires its defining schema');
  if (file.jsonSchema !== undefined) {
    if (ports.definedJson !== undefined) ports.definedJson(validationSourceBytes(file.jsonSchema), bytes, file.name);
    else if (contract === undefined || file.name === undefined) throw new Error('Unregistered named JSON with a schema needs a JSON Schema checker');
    else {
      if (file.jsonSchema['$comment'] !== contract.source) throw new Error('Registered JSON requires its exact defining format contract');
      validateRegisteredJson(file.name, parseNamedJson(bytes));
    }
  }
  if (file.kind === 'json' && file.name !== undefined) {
    const source = file.jsonSchema?.['$comment'];
    if (validatePlatformFile(file.name, typeof source === 'string' ? source : undefined, parseNamedJson(bytes)) === undefined) throw new Error(`Unregistered named JSON: ${file.name}`);
  }
  const legacy = file.kind === 'bin' || file.kind === 'tile' ? 'binary' : file.kind;
  if (outputBlobKind(legacy, bytes) !== file.kind || !file.path.endsWith(`.${outputBlobExtension(file.kind, bytes)}`)) throw new Error('Output blob bytes differ from their declared kind');
  const cost = assetCost(legacy, bytes, script);
  if ((['decoded', 'gpu', 'triangles', 'draws'] as const).some(key => cost[key] > file[key])) throw new Error('Output blob understates parsed costs');
}

/** Validate a built product folder with format alone: the index and section schemas, the exact inventory (no unlisted,
 *  missing or changed file), every hash and size, byte kinds against declared kinds and costs, KTX2 device costs, pack
 *  members, registered named JSON, budgets and admission, world targets and the declared source hash. */
export function validateShardfileProduct(files: ProductFiles, ports: ProductValidationPorts): ValidatedProduct {
  const verify = ports.verify ?? ((bytes: Uint8Array, expected: string): boolean => ports.hash(bytes) === expected);
  const index = parseOutputIndex(readCanonicalJson(files.read('shard.json', limits.sourceBytes)));
  const listed = new Set(['shard.json', 'validation.json']), payloads = new Map<string, unknown>(), assets = new Map<string, Uint8Array>();
  const read = (entry: { path: string; hash: string; bytes: number }): Uint8Array => {
    listed.add(entry.path);
    const bytes = files.read(entry.path, entry.bytes);
    if (bytes.length !== entry.bytes || !verify(bytes, entry.hash, true)) throw new Error(`Output hash or size mismatch: ${entry.path}`);
    return bytes;
  };
  for (const entry of index.sections) { const value = readCanonicalJson(read(entry)); validateOutputSection(entry.name, value); payloads.set(entry.name, value); }
  const scripts = scriptAdmissionRows(payloads), contracts = decisionModuleContracts(scripts, index.files);
  for (const entry of index.files) {
    const bytes = read({ path: entry.path, hash: entry.hash, bytes: entry.compressed });
    inspectBlob(entry, bytes, ports, entry.kind === 'wasm' ? contracts.get(entry.hash) ?? { abi: 0 } : undefined);
    assets.set(`${entry.commons === true ? 'commons:' : ''}${entry.hash}`, bytes);
    if (index.requires.commons.includes(entry.hash)) assets.set(`commons:${entry.hash}`, bytes);
  }
  for (const [hash, cost] of Object.entries(index.ktx2Costs ?? {})) {
    const bytes = assets.get(hash);
    if (bytes === undefined || decoder().decode(validationSourceBytes(cost)) !== decoder().decode(validationSourceBytes(ktx2DeviceCosts(bytes)))) throw new Error('KTX2 device costs differ from verified bytes');
  }
  for (const pack of index.packs ?? []) {
    const bytes = read(pack);
    for (const entry of pack.entries) if (!verify(bytes.subarray(entry.offset, entry.offset + entry.bytes), entry.hash, false)) throw new Error(`Pack member differs: ${pack.path}`);
  }
  for (const entry of index.runtime?.files ?? []) {
    if (ports.runtimeImports === undefined) throw new Error('Copied runtime files need a runtime import checker');
    ports.runtimeImports(entry.path, decoder().decode(read(entry)));
  }
  for (const path of files.paths()) if (!listed.has(path)) throw new Error(`Unlisted output file: ${path}`);
  const shard = admitShardfileProduct(assembleOutputShardfile(index, payloads), assets, ports.hash, 'warn', scripts);
  checkWorldTargets(shard, payloads.get('world/targets'));
  if (ports.hash(validationSourceBytes(shard)) !== index.build.sourceHash) throw new Error('Output sections differ from the declared source hash');
  return { index, shard, assets, sections: payloads, scripts };
}
