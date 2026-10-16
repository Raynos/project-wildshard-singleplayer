import type { ScriptContract } from '@wildshard/format/scriptContract';
import { assetCost, type AssetCost } from '@wildshard/format/product';
import { parseImageAsset } from '@wildshard/format/stillImage';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { outputBlobPath, type OutputFile } from '@wildshard/format/outputIndex';
import { hashImmutableBytes, encodeCanonicalJson } from './immutable';
import { compileGltfSource } from './bake/gltfSource';
import { compressGlb } from './bake/glbCompression';

/** JSON belongs to sections; these named bytes occupy a kind-specific content-addressed blob path. */
export type NamedBlobKind = Exclude<OutputFile['kind'], 'json'>;
/** Conservative owner costs may exceed measured minima; undersized claims refuse before emission. */
export interface BlobOptions extends Partial<AssetCost> { readonly script?: ScriptContract; readonly critical?: boolean; readonly dependencies?: readonly string[] }
/** Build-only meshopt candidate, kept only if gzip-9 does not grow; compressed input needs no option. */
export interface BlobSourceOptions extends BlobOptions { readonly meshopt?: boolean }
/** One owned byte array and the exact index entry that names it. */
export interface NamedBlob { readonly file: OutputFile; readonly bytes: Uint8Array; readonly script?: ScriptContract }
/** The writer merges declarations into admission before emitting these immutable assets. */
export interface EmittedBlobs { readonly files: readonly OutputFile[]; readonly assets: ReadonlyMap<string, Uint8Array> }

const MAX_BYTES = 25_000_000;
const logicalName = /^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/u;
const reference = /^(?:commons:)?[a-f0-9]{64}$/u;
const kinds = new Set<NamedBlobKind>(['glb', 'ktx2', 'image', 'audio', 'wasm', 'bin', 'tile']);

function assertName(name: string): void {
  if (name.length > 240 || !logicalName.test(name) || name.split('/').some(part => part === '.' || part === '..')) throw new Error('Blob logical name must be a bounded relative path');
}

function isTextGltf(bytes: Uint8Array): boolean {
  let json: unknown;
  try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { return false; }
  return typeof json === 'object' && json !== null && 'asset' in json && typeof json.asset === 'object'
    && json.asset !== null && 'version' in json.asset && json.asset.version === '2.0';
}

function extension(kind: NamedBlobKind, bytes: Uint8Array): string {
  if (kind === 'image') return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[parseImageAsset(bytes).mime];
  if (kind === 'audio') return new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' ? 'wav' : 'm4a';
  if (kind === 'tile') { decodeTerrainTile(bytes); return 'wtt'; }
  return kind === 'bin' ? 'bin' : kind;
}

/** Admit actual bytes, hash their owned copy and attach a stable logical name. No author-provided hash or path is used.
 * Binary channel-specific and cross-reference admission still belongs to the section's defining reader/product build. */
export function nameBlob(name: string, kind: NamedBlobKind, input: Uint8Array, options: BlobOptions = {}): NamedBlob {
  assertName(name);
  if (!kinds.has(kind)) throw new Error('Unsupported named blob kind');
  if (input.length === 0 || input.length > MAX_BYTES) throw new Error('Blob exceeds its wire byte cap');
  const bytes = Uint8Array.from(input), suffix = extension(kind, bytes);
  if (kind === 'bin' && isTextGltf(bytes)) throw new Error('Text glTF must compile to GLB, never a binary blob');
  if (kind !== 'wasm' && options.script !== undefined) throw new Error('Script contract requires a Wasm blob');
  const actual = assetCost(kind === 'bin' || kind === 'tile' ? 'binary' : kind, bytes, options.script);
  const costs = { decoded: options.decoded ?? actual.decoded, gpu: options.gpu ?? actual.gpu, triangles: options.triangles ?? actual.triangles, draws: options.draws ?? actual.draws };
  for (const key of ['decoded', 'gpu', 'triangles', 'draws'] as const) if (!Number.isSafeInteger(costs[key]) || costs[key] < actual[key]) throw new Error('Blob costs cannot understate actual bytes or geometry');
  const dependencies = [...options.dependencies ?? []];
  if (dependencies.some(hash => !reference.test(hash)) || new Set(dependencies).size !== dependencies.length || (options.critical !== undefined && typeof options.critical !== 'boolean')) throw new Error('Invalid blob dependencies or admission policy');
  const hash = hashImmutableBytes(bytes);
  const file: OutputFile = { name, path: `blobs/${kind}/${hash}.${suffix}`, kind, hash, compressed: bytes.length, ...costs, critical: options.critical ?? false, dependencies };
  outputBlobPath(file);
  return { file, bytes, ...(options.script === undefined ? {} : { script: { ...options.script } }) };
}

/** Read only project-contained files. Textual .gltf sources compile with bounded local/embedded resources into GLB;
 * an escape (including through a symlink), remote URI or unsupported extension refuses before publication. */
export async function readNamedBlob(project: string, name: string, source: string, kind: NamedBlobKind, options: BlobSourceOptions = {}): Promise<NamedBlob> {
  const [fileSystem, pathTools, { readBoundedFile }, compression] = await Promise.all([
    // oxlint-disable-next-line import/no-nodejs-modules -- Only explicit CLI file intake loads filesystem access.
    import('node:fs'),
    // oxlint-disable-next-line import/no-nodejs-modules -- Keep config-only nameBlob imports free of file services.
    import('node:path'),
    import('./sourceReader'),
    // oxlint-disable-next-line import/no-nodejs-modules -- Compare actual download encoding only during CLI intake.
    import('node:zlib'),
  ]);
  const root = fileSystem.realpathSync(project);
  const contained = (base: string, path: string): string => {
    const relative = decodeURIComponent(path);
    if (pathTools.isAbsolute(relative) || relative.includes('\\') || (/[:?#]/u.test(relative) || relative.includes(String.fromCodePoint(0)))) throw new Error('Blob source must be a local relative path');
    const file = fileSystem.realpathSync(pathTools.resolve(base, relative));
    if (!file.startsWith(`${root}${pathTools.sep}`)) throw new Error('Blob source escapes its project');
    return file;
  };
  const file = contained(root, source), bytes = readBoundedFile(file, MAX_BYTES);
  if (options.meshopt !== undefined && typeof options.meshopt !== 'boolean') throw new Error('Invalid meshopt compression option');
  if (options.meshopt === true && kind !== 'glb') throw new Error('Meshopt compression requires a GLB blob');
  const admit = (value: Uint8Array): NamedBlob => {
    if (options.meshopt !== true) return nameBlob(name, kind, value, options);
    const packed = compressGlb(value);
    const selected = compression.gzipSync(packed, { level: 9 }).length <= compression.gzipSync(value, { level: 9 }).length ? packed : value;
    return nameBlob(name, kind, selected, options);
  };
  if (source.toLowerCase().endsWith('.gltf')) {
    if (kind !== 'glb') throw new Error('Text glTF must compile to a GLB blob');
    return admit(await compileGltfSource(bytes, uri => readBoundedFile(contained(pathTools.dirname(file), uri), MAX_BYTES)));
  }
  return admit(bytes);
}

/** Revalidate every owned entry before returning sorted declarations/assets. One hash has one logical name;
 * duplicate names, aliases and post-admission mutation refuse rather than producing ambiguous index entries. */
export function emitNamedBlobs(blobs: readonly NamedBlob[]): EmittedBlobs {
  const files: OutputFile[] = [], assets = new Map<string, Uint8Array>(), names = new Set<string>();
  for (const row of blobs) {
    if (row.file.name === undefined) throw new Error('Named blob needs its logical name');
    if (row.file.kind === 'json') throw new Error('JSON belongs to sections');
    const checked = nameBlob(row.file.name, row.file.kind, row.bytes, { ...row.file, ...(row.script === undefined ? {} : { script: row.script }) });
    if (encodeCanonicalJson(checked.file) !== encodeCanonicalJson(row.file)) throw new Error('Named blob changed after admission');
    if (names.has(row.file.name) || assets.has(row.file.hash)) throw new Error('Duplicate blob name or content reference');
    names.add(row.file.name); files.push(checked.file); assets.set(row.file.hash, checked.bytes);
  }
  files.sort((a, b) => (a.name ?? '') < (b.name ?? '') ? -1 : (a.name ?? '') > (b.name ?? '') ? 1 : 0);
  return { files, assets: new Map([...assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) };
}
