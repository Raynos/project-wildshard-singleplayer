// oxlint-disable-next-line import/no-nodejs-modules -- Search asset bytes natively.
import { Buffer } from 'node:buffer';
import type { PreparedProjectOutput } from '../../src/sdk/projectOutput';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';

/** D179 B's predecessor layer (as T8's and I3's): Nine's city fabric moved from the resident 'native' whole library into
 *  'native-refine' (load 'refine'). Two output files change and nothing else: world/fabric.json's layout mesh nodes name
 *  the new library, and the world/scenes section declares it. The predecessor of each is the same rows with the fabric back
 *  in 'native' (its models first, the layout aliases having been declared first) and no refine library. Refuses anything
 *  else that differs. */
const text = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const REFINE = /"library":\s*"native-refine"/gu;

/** world/fabric.json as it was: every node naming the refine library names 'native' */
export function fabricPredecessor(bytes: Uint8Array): Uint8Array {
  // only a JSON file naming the refine library changes (every other asset, binary ones too, is returned as it is)
  if (!Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes('"native-refine"')) return bytes;
  return new TextEncoder().encode(text(bytes).replace(REFINE, '"library":"native"'));
}

interface WholeLibrary { readonly id: string; readonly kind: string; readonly load?: string; readonly models: readonly { readonly id: string }[] }
/** the world/scenes section as it was: the refine library's models back at the head of 'native', the refine row gone */
export function scenesPredecessor(bytes: Uint8Array): Uint8Array {
  const section: unknown = JSON.parse(text(bytes));
  if (typeof section !== 'object' || section === null || !('libraries' in section) || !Array.isArray(section.libraries)) throw new Error('Nine scenes without libraries');
  const libraries = section.libraries as WholeLibrary[], refine = libraries.find(row => row.id === 'native-refine'), native = libraries.find(row => row.id === 'native');
  if (refine === undefined) return bytes;
  if (native === undefined || refine.load !== 'refine' || refine.models.some(row => !row.id.startsWith('layout-'))) throw new Error('Nine refine library differs from D179 B');
  const next = libraries.filter(row => row !== refine).map(row => row === native ? { ...native, models: [...refine.models, ...native.models] } : row);
  return new TextEncoder().encode(encodeCanonicalJson({ ...section, libraries: next }));
}

/** a prepared Nine output with both files put back: the fabric asset under its predecessor hash, and the scenes section
 *  file and row with the predecessor's bytes */
export function nineRefinePredecessor(prepared: PreparedProjectOutput): PreparedProjectOutput {
  const assets = new Map<string, Uint8Array>();
  for (const [hash, bytes] of prepared.assets) {
    const before = fabricPredecessor(bytes);
    assets.set(before === bytes ? hash : hashImmutableBytes(before), before);
  }
  // a named blob (and its named-file row) whose bytes change takes the predecessor's hash, path and sizes
  const renamed = new Map<string, { hash: string; bytes: number }>();
  const blobs = prepared.blobs.map(blob => {
    const before = fabricPredecessor(blob.bytes);
    if (before === blob.bytes) return blob;
    const hash = hashImmutableBytes(before), file = { ...blob.file, hash, path: blob.file.path.replace(blob.file.hash, hash), compressed: before.byteLength,
      decoded: blob.file.decoded === blob.file.compressed ? before.byteLength : blob.file.decoded };
    renamed.set(blob.file.hash, { hash, bytes: before.byteLength });
    return { ...blob, file, bytes: before };
  });
  const namedFiles = prepared.options.namedFiles?.map(row => {
    const next = renamed.get(row.hash);
    return next === undefined ? row : { ...row, hash: next.hash, path: row.path.replace(row.hash, next.hash), compressed: next.bytes, decoded: row.decoded === row.compressed ? next.bytes : row.decoded };
  });
  const options = namedFiles === undefined ? prepared.options : { ...prepared.options, namedFiles };
  const platform = options.platform;
  if (platform === undefined) return { ...prepared, blobs, assets, options };
  const path = 'sections/world/scenes.json', current = platform.files.get(path);
  if (current === undefined) return { ...prepared, blobs, assets, options };
  const scenes = scenesPredecessor(current), files = new Map(platform.files);
  files.set(path, scenes);
  const sections = platform.sections.map(row => row.path === path ? { ...row, hash: hashImmutableBytes(scenes), bytes: scenes.byteLength } : row);
  return { ...prepared, blobs, assets, options: { ...options, platform: { ...platform, files, sections } } };
}

/** the same layer over a project output (the Nine program's own `output`): its fabric asset and named-file row */
export function nineOutputRefinePredecessor<O extends { readonly assets?: ReadonlyMap<string, Uint8Array>; readonly namedFiles?: readonly { readonly hash: string; readonly path: string; readonly compressed: number; readonly decoded: number }[];
  readonly platform?: { readonly files: ReadonlyMap<string, Uint8Array>; readonly sections: readonly { readonly path: string; readonly hash: string; readonly bytes: number }[] } }>(output: O): O {
  const assets = new Map<string, Uint8Array>(), renamed = new Map<string, { hash: string; bytes: number }>();
  for (const [hash, bytes] of output.assets ?? new Map<string, Uint8Array>()) {
    const before = fabricPredecessor(bytes);
    if (before === bytes) { assets.set(hash, bytes); continue; }
    const next = hashImmutableBytes(before); assets.set(next, before); renamed.set(hash, { hash: next, bytes: before.byteLength });
  }
  const namedFiles = output.namedFiles?.map(row => {
    const next = renamed.get(row.hash);
    return next === undefined ? row : { ...row, hash: next.hash, path: row.path.replace(row.hash, next.hash), compressed: next.bytes, decoded: row.decoded === row.compressed ? next.bytes : row.decoded };
  });
  const path = 'sections/world/scenes.json', platform = output.platform, current = platform?.files.get(path);
  const projected = platform === undefined || current === undefined ? undefined : (() => {
    const scenes = scenesPredecessor(current), files = new Map(platform.files); files.set(path, scenes);
    return { ...platform, files, sections: platform.sections.map(row => row.path === path ? { ...row, hash: hashImmutableBytes(scenes), bytes: scenes.byteLength } : row) };
  })();
  return { ...output, ...(output.assets === undefined ? {} : { assets }), ...(namedFiles === undefined ? {} : { namedFiles }), ...(projected === undefined ? {} : { platform: projected }) };
}
