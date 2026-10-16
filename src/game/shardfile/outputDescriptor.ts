import { assembleOutputShardfile, isOutputIndex, outputBlobPath, parseOutputIndex, type OutputIndex } from '@wildshard/format/outputIndex';
import { isJsonData } from '@wildshard/format/json';
import type { Shardfile } from '@wildshard/format/shardSchema';

/** Byte readers are injected: the section adapter runs in browsers and renderer-free Node admission. */
export interface OutputDescriptorReader {
  read: (path: string, maximum: number) => Promise<Uint8Array>;
  hash: (bytes: Uint8Array) => Promise<string>;
  cached?: (hash: string) => Promise<Uint8Array | null>;
  store?: (hash: string, bytes: Uint8Array) => Promise<boolean>;
  offline: boolean;
}

export interface OutputDescriptor {
  readonly index: OutputIndex;
  readonly sections: ReadonlyMap<string, unknown>;
  readonly cached: boolean;
}
// Existing hosts consume the unchanged Shardfile shape. Keying by its files array
// also preserves location through the hosts' shallow presentation-only copies.
const descriptors = new WeakMap<object, OutputDescriptor>();

/** The admitted v2 index and parsed sections, if this source came from a split output. */
export function outputDescriptor(source: { readonly files: object }): OutputDescriptor | undefined { return descriptors.get(source.files); }

/** Carry verified transport metadata across the existing parser's owned copy. */
export function carryOutputDescriptor(from: unknown, to: Shardfile): void {
  if (typeof from !== 'object' || from === null || !('files' in from) || !Array.isArray(from.files)) return;
  const descriptor = descriptors.get(from.files);
  if (descriptor !== undefined) descriptors.set(to.files, descriptor);
}

/**
 * Read all sections needed by today's complete Shardfile hosts, checking exact
 * byte sizes and hashes before assembly. v1 inputs pass through to their version
 * reader unchanged. Platform hosts receive their complete admitted model.
 */
export async function resolveOutputDescriptor(input: unknown, reader: OutputDescriptorReader): Promise<unknown> {
  if (!isJsonData(input)) throw new Error('Shardfile descriptor requires bounded plain JSON');
  if (!isOutputIndex(input)) return input;
  const index = parseOutputIndex(input);
  const sections = new Map<string, unknown>();
  let cached = reader.cached !== undefined;
  const load = async (section: OutputIndex['sections'][number]): Promise<readonly [string, unknown]> => {
    let bytes = await reader.cached?.(section.hash);
    if (bytes === null || bytes === undefined) {
      if (reader.offline) throw new Error('Visited shardfile has an incomplete section cache');
      bytes = await reader.read(section.path, section.bytes);
      if (bytes.length !== section.bytes || await reader.hash(bytes) !== section.hash) throw new Error('Shardfile section hash or size mismatch');
      if (reader.store === undefined || !await reader.store(section.hash, bytes)) cached = false;
    } else if (bytes.length !== section.bytes || await reader.hash(bytes) !== section.hash) throw new Error('Cached shardfile section hash or size mismatch');
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return [section.name, value];
  };
  // Each section is independently bounded; launch the complete inventory in
  // parallel, and settle every request before returning a failed admission.
  const results = await Promise.allSettled(index.sections.map(load));
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
    sections.set(...result.value);
  }
  const source = assembleOutputShardfile(index, sections);
  descriptors.set(source.files, { index, sections, cached });
  return source;
}

/** Resolve only declared content: v2 uses its kind/hash path; v1 keeps the bare hash URL. */
export function outputBlobUrl(source: Shardfile, ref: string, base: string): string {
  const hash = ref.replace(/^commons:/u, '');
  if (!/^[a-f0-9]{64}$/u.test(hash) || (ref.startsWith('commons:')
    ? !source.requires.commons.includes(hash) : !source.files.some(file => file.hash === hash))) throw new Error('Undeclared shardfile blob');
  const descriptor = outputDescriptor(source);
  if (descriptor === undefined) return new URL(hash, base).href;
  const file = descriptor.index.files.find(entry => entry.hash === hash);
  if (file === undefined) throw new Error('Missing shardfile blob path');
  return new URL(outputBlobPath(file), base).href;
}
