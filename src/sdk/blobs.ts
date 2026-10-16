// oxlint-disable-next-line import/no-nodejs-modules -- Author intake resolves symlinks before reading bounded project files.
import { realpathSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Relative source resources must remain inside the author's project.
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { assetCost, type AssetCost } from '@wildshard/format/product';
import { parseStillImage } from '@wildshard/format/stillImage';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { outputBlobPath, type OutputFile } from '@wildshard/format/outputIndex';
import { hashImmutableBytes, encodeCanonicalJson } from './immutable';
import { readBoundedFile } from './sourceReader';
import { compileGltfSource } from './bake/gltfSource';

/** JSON belongs to sections; these named bytes occupy a kind-specific content-addressed blob path. */
export type NamedBlobKind = Exclude<OutputFile['kind'], 'json'>;
/** Conservative owner costs may exceed measured minima; undersized claims refuse before emission. */
export interface BlobOptions extends Partial<AssetCost> { readonly critical?: boolean; readonly dependencies?: readonly string[] }
/** One owned byte array and the exact index entry that names it. */
export interface NamedBlob { readonly file: OutputFile; readonly bytes: Uint8Array }
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
  if (kind === 'image') return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[parseStillImage(bytes).mime];
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
  const actual = assetCost(kind === 'bin' || kind === 'tile' ? 'binary' : kind, bytes);
  const costs = { decoded: options.decoded ?? actual.decoded, gpu: options.gpu ?? actual.gpu, triangles: options.triangles ?? actual.triangles, draws: options.draws ?? actual.draws };
  for (const key of ['decoded', 'gpu', 'triangles', 'draws'] as const) if (!Number.isSafeInteger(costs[key]) || costs[key] < actual[key]) throw new Error('Blob costs cannot understate actual bytes or geometry');
  const dependencies = [...options.dependencies ?? []];
  if (dependencies.some(hash => !reference.test(hash)) || new Set(dependencies).size !== dependencies.length || (options.critical !== undefined && typeof options.critical !== 'boolean')) throw new Error('Invalid blob dependencies or admission policy');
  const hash = hashImmutableBytes(bytes);
  const file: OutputFile = { name, path: `blobs/${kind}/${hash}.${suffix}`, kind, hash, compressed: bytes.length, ...costs, critical: options.critical ?? false, dependencies };
  outputBlobPath(file);
  return { file, bytes };
}

/** Read only project-contained files. Textual .gltf sources compile with bounded local/embedded resources into GLB;
 * an escape (including through a symlink), remote URI or unsupported extension refuses before publication. */
export async function readNamedBlob(project: string, name: string, source: string, kind: NamedBlobKind, options: BlobOptions = {}): Promise<NamedBlob> {
  const root = realpathSync(project);
  const contained = (base: string, path: string): string => {
    const relative = decodeURIComponent(path);
    if (isAbsolute(relative) || relative.includes('\\') || (/[:?#]/u.test(relative) || relative.includes(String.fromCodePoint(0)))) throw new Error('Blob source must be a local relative path');
    const file = realpathSync(resolve(base, relative));
    if (!file.startsWith(`${root}${sep}`)) throw new Error('Blob source escapes its project');
    return file;
  };
  const file = contained(root, source), bytes = readBoundedFile(file, MAX_BYTES);
  if (source.toLowerCase().endsWith('.gltf')) {
    if (kind !== 'glb') throw new Error('Text glTF must compile to a GLB blob');
    return nameBlob(name, kind, await compileGltfSource(bytes, uri => readBoundedFile(contained(dirname(file), uri), MAX_BYTES)), options);
  }
  return nameBlob(name, kind, bytes, options);
}

/** Revalidate every owned entry before returning sorted declarations/assets. One hash has one logical name;
 * duplicate names, aliases and post-admission mutation refuse rather than producing ambiguous index entries. */
export function emitNamedBlobs(blobs: readonly NamedBlob[]): EmittedBlobs {
  const files: OutputFile[] = [], assets = new Map<string, Uint8Array>(), names = new Set<string>();
  for (const row of blobs) {
    if (row.file.name === undefined) throw new Error('Named blob needs its logical name');
    if (row.file.kind === 'json') throw new Error('JSON belongs to sections');
    const checked = nameBlob(row.file.name, row.file.kind, row.bytes, row.file);
    if (encodeCanonicalJson(checked.file) !== encodeCanonicalJson(row.file)) throw new Error('Named blob changed after admission');
    if (names.has(row.file.name) || assets.has(row.file.hash)) throw new Error('Duplicate blob name or content reference');
    names.add(row.file.name); files.push(checked.file); assets.set(row.file.hash, checked.bytes);
  }
  files.sort((a, b) => (a.name ?? '') < (b.name ?? '') ? -1 : (a.name ?? '') > (b.name ?? '') ? 1 : 0);
  return { files, assets: new Map([...assets].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) };
}
