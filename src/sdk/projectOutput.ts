import * as v from 'valibot';
import { ScriptContractSchema, decisionModuleContracts } from '@wildshard/format/scriptContract';
import { OutputIndexSchema, type OutputFile } from '@wildshard/format/outputIndex';
import { ShardNaturalSchema } from '@wildshard/format/shardSections';
import { parseShardfile, type Shardfile } from './shardfile';
import { readNamedBlob, emitNamedBlobs, nameBlob, type NamedBlob } from './blobs';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { defineMirror, type RuntimeMirror } from './runtimeMirrors';
import type { EmittedSections } from './sections';
import { outputDecisionScripts, type OutputProductOptions } from './outputProduct';

const bytes = v.custom<Uint8Array>(value => value instanceof Uint8Array);
const assetMap = v.map(v.string(), bytes);
const emitted = v.strictObject({ sections: OutputIndexSchema.entries.sections, files: assetMap });
const options = v.strictObject({
  decoded: v.exactOptional(ShardNaturalSchema), gpu: v.exactOptional(ShardNaturalSchema),
  triangles: v.exactOptional(ShardNaturalSchema), draws: v.exactOptional(ShardNaturalSchema),
  script: v.exactOptional(ScriptContractSchema),
  meshopt: v.exactOptional(v.boolean()), critical: v.exactOptional(v.boolean()), dependencies: v.exactOptional(v.array(v.string())),
});
const declaration = v.strictObject({
  name: v.string(), kind: v.picklist(['glb', 'ktx2', 'image', 'audio', 'wasm', 'bin', 'tile']),
  source: v.string(), options: v.exactOptional(options),
});
const output = v.strictObject({
  blobs: v.optional(v.pipe(v.array(declaration), v.maxLength(8192)), []),
  custom: v.exactOptional(emitted), platform: v.exactOptional(emitted),
  namedFiles: v.optional(OutputIndexSchema.entries.files, []), assets: v.optional(assetMap, () => new Map()),
});

/** Build-only config export: source paths are resolved by the CLI, never by author module side effects. */
export interface ProjectOutput extends Omit<OutputProductOptions, 'runtime'> {
  readonly blobs?: readonly v.InferOutput<typeof declaration>[];
  readonly assets?: ReadonlyMap<string, Uint8Array>;
}
/** Prepared extensions and new named bytes, still subject to complete product/disk admission. */
export interface PreparedProjectOutput {
  readonly blobs: readonly NamedBlob[];
  readonly options: Omit<OutputProductOptions, 'runtime'>;
  readonly assets: ReadonlyMap<string, Uint8Array>;
}

function ownedAssets(input: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const assets = new Map<string, Uint8Array>();
  for (const [hash, value] of input) {
    if (hashImmutableBytes(value) !== hash) throw new Error('Authored output asset hash differs from its bytes');
    assets.set(hash, Uint8Array.from(value));
  }
  return assets;
}
function ownedSections(input: EmittedSections): EmittedSections {
  return { sections: input.sections.map(row => ({ ...row })), files: new Map([...input.files].map(([path, value]) => [path, Uint8Array.from(value)])) };
}

/** Parse the optional output export and compile project-contained inputs (including glTF) into immutable blobs. */
export async function prepareProjectOutput(project: string, input: unknown): Promise<PreparedProjectOutput> {
  const parsed = v.parse(output, input === undefined ? {} : input), blobs: NamedBlob[] = [], overlays: OutputFile[] = [];
  for (const row of parsed.blobs) blobs.push(await readNamedBlob(project, row.name, row.source, row.kind, row.options));
  const inventory = [...parsed.namedFiles, ...blobs.map(row => row.file)];
  // Other rows may name files already declared by the root source; full product admission resolves those.
  const scripts = outputDecisionScripts(parsed.platform).filter(row => inventory.some(file => file.path === row.module));
  const contracts = decisionModuleContracts(scripts, inventory);
  for (const file of parsed.namedFiles) {
    const value = parsed.assets.get(file.hash);
    if (value === undefined) overlays.push(file);
    else {
      const script = file.kind === 'wasm' ? contracts.get(file.hash) ?? { abi: 0 as const } : undefined;
      const checked = emitNamedBlobs([{ file, bytes: value, ...(script === undefined ? {} : { script }) }]), owned = checked.assets.get(file.hash);
      if (owned === undefined) throw new Error('Named output asset was not admitted');
      blobs.push({ file, bytes: owned, ...(script === undefined ? {} : { script }) });
    }
  }
  return { blobs, assets: ownedAssets(parsed.assets), options: {
    namedFiles: overlays,
    ...(parsed.custom === undefined ? {} : { custom: ownedSections(parsed.custom) }),
    ...(parsed.platform === undefined ? {} : { platform: ownedSections(parsed.platform) }),
  } };
}

/** Expose build-time mirrors without loading or executing the copied runtime module. */
export function projectMirrors(input: unknown): readonly RuntimeMirror[] {
  const rows = v.parse(v.pipe(v.array(v.strictObject({ name: v.string(), value: v.unknown() })), v.maxLength(8192)), input === undefined ? [] : input);
  const names = new Set<string>();
  return rows.map(row => {
    if (names.has(row.name)) throw new Error('Duplicate runtime mirror');
    names.add(row.name); return defineMirror(row.name, row.value);
  });
}

function libraryCost(source: Shardfile): { compressed: number; resident: number } {
  const files = new Map(source.files.map(file => [file.hash, file])), seen = new Set<string>(), pending = [...source.library];
  let compressed = 0, resident = 0;
  while (pending.length > 0) {
    const hash = pending.pop(); if (hash === undefined || seen.has(hash)) continue;
    seen.add(hash);
    if (hash.startsWith('commons:')) {
      const key = hash.slice(8), cost = source.requires.commonsCosts[key];
      if (cost === undefined) throw new Error('Missing named library commons cost');
      compressed += source.requires.commonsWire[key] ?? 0; resident += cost.decoded + cost.gpu;
    } else {
      const file = files.get(hash); if (file === undefined) throw new Error('Missing named library dependency');
      compressed += file.compressed; resident += file.decoded + file.gpu; pending.push(...file.dependencies);
    }
  }
  return { compressed, resident };
}

/** Admit named bytes once. Existing declarations, conservative costs and names win when content is reused;
 * new content becomes a library root and charges only the newly reachable closure. Inputs are never mutated. */
export function mergeProjectBlobs(input: Shardfile, inputAssets: ReadonlyMap<string, Uint8Array>, blobs: readonly NamedBlob[], namedFiles: readonly OutputFile[] = []): { shard: Shardfile; assets: Map<string, Uint8Array>; namedFiles: readonly OutputFile[] } {
  const source = parseShardfile(input), before = libraryCost(source), assets = new Map(inputAssets);
  const files = new Map(source.files.map(file => [file.hash, file]));
  const named = new Map<string, OutputFile>(), names = new Map<string, string>();
  for (const file of v.parse(OutputIndexSchema.entries.files, namedFiles)) {
    if (file.name === undefined || named.has(file.hash) || names.has(file.name)) throw new Error('Duplicate or absent named output identity');
    named.set(file.hash, file); names.set(file.name, file.hash);
  }
  for (const blob of blobs) {
    emitNamedBlobs([blob]);
    const file = blob.file, name = file.name;
    if (name === undefined || file.kind === 'json') throw new Error('Named source blob needs a binary kind and name');
    const claimed = names.get(name);
    if (claimed !== undefined && claimed !== file.hash) throw new Error('Blob logical name has conflicting content');
    const existing = files.get(file.hash), common = source.requires.commons.includes(file.hash);
    const previous = assets.get(file.hash) ?? (common ? assets.get(`commons:${file.hash}`) : undefined);
    if (previous !== undefined && (hashImmutableBytes(previous) !== file.hash || previous.length !== blob.bytes.length || previous.some((value, index) => value !== blob.bytes[index]))) throw new Error('Blob conflicts with admitted asset bytes');
    let overlay: OutputFile;
    if (existing !== undefined) {
      if (existing.kind !== (file.kind === 'bin' || file.kind === 'tile' ? 'binary' : file.kind) || existing.compressed !== blob.bytes.length) throw new Error('Blob kind or size differs from admitted declaration');
      overlay = nameBlob(name, file.kind, blob.bytes, { ...existing, ...(blob.script === undefined ? {} : { script: blob.script }) }).file;
    } else if (common) {
      const cost = source.requires.commonsCosts[file.hash];
      if (cost === undefined || source.requires.commonsWire[file.hash] !== blob.bytes.length) throw new Error('Blob differs from admitted commons');
      overlay = { ...nameBlob(name, file.kind, blob.bytes, { ...cost, ...(blob.script === undefined ? {} : { script: blob.script }) }).file, commons: true };
    } else {
      const { name: _name, path: _path, kind, ...metadata } = file;
      const added = { ...metadata, kind: kind === 'bin' || kind === 'tile' ? 'binary' as const : kind };
      source.files.push(added); files.set(file.hash, added);
      if (file.critical) {
        source.critical.push(file.hash);
        source.budgets.sim.compressed += file.compressed;
        source.budgets.sim.resident += file.decoded + file.gpu;
      } else source.library.push(file.hash);
      overlay = file;
    }
    const old = named.get(file.hash);
    if (old !== undefined) {
      const { name: _oldName, ...oldMetadata } = old, { name: _newName, ...newMetadata } = overlay;
      if (encodeCanonicalJson(oldMetadata) !== encodeCanonicalJson(newMetadata)) throw new Error('Named blob metadata conflicts with admission');
    } else named.set(file.hash, overlay);
    names.set(name, file.hash);
    if (existing !== undefined || !common) assets.set(file.hash, Uint8Array.from(blob.bytes));
  }
  const after = libraryCost(source), budget = source.budgets.library;
  budget.compressed += after.compressed - before.compressed; budget.resident += after.resident - before.resident;
  if (budget.downloadAllowance !== undefined) budget.downloadAllowance += after.compressed - before.compressed;
  return { shard: parseShardfile(source), assets, namedFiles: [...named.values()] };
}
