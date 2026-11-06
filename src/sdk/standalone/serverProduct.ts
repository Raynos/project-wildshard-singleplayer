import type { Rapier } from '@wildshard/engine/physics/rapier';
import { isOutputIndex } from '@wildshard/format/outputAddress';
import { parseShardfile } from '@wildshard/format/shardSchema';
import { contentHash } from '@wildshard/game/shardfile/contentHash';
import { nodeNamedJsonCheck, nodeOutputDescriptorChecks } from '@wildshard/game/shardfile/outputChecksNode';
import { carryOutputDescriptor, outputDescriptor, resolveOutputDescriptor, serverReadsFile } from '@wildshard/game/shardfile/outputDescriptor';
import { shardProductData } from '@wildshard/game/shardfile/productData';
import { readServerPackBook, serverPackBookPath, serverPackFile, type ServerPack } from '@wildshard/game/shardfile/serverPack';
import type { HeadlessRuntimeInput } from '../headlessRuntime';
import type { HeldRead } from './heldReads';

/** A file a page or an earlier server read left in Cache Storage. An index is held under its `?v=`, which a worker can't know. */
function heldBytes(url: URL): Promise<Response | undefined> | undefined {
  return typeof caches === 'undefined' ? undefined : caches.match(url.href, { ignoreSearch: true, ignoreVary: true });
}
/** The network's answer, or offline what the device holds: a level the player has been to boots with no link. Every byte is verified after this. */
async function serverBytes(url: URL, path: string, held?: HeldRead): Promise<Uint8Array> {
  const lent = await held?.(url.href); // DL25: what the page holds moves no bytes
  if (lent !== undefined && lent !== null) return new Uint8Array(lent);
  const response = await fetch(url).catch(() => undefined);
  const usable = response?.ok === true ? response : await heldBytes(url);
  if (usable === undefined) throw new Error(`Missing server input ${path}`);
  return new Uint8Array(await usable.arrayBuffer());
}

/** C2: reads a server file from its product's pack, fetching the book and the pack once. The browser undoes `br`. */
function serverPackReader(root: string, slug: string): (path: string) => Promise<Uint8Array> {
  let opened: Promise<{ readonly pack: ServerPack; readonly body: Uint8Array }> | undefined;
  const open = async (): Promise<{ readonly pack: ServerPack; readonly body: Uint8Array }> => {
    // The worker runs from its build's folder (`/b/<build>/standalone/`), which says whose book to read.
    const build = /^\/b\/([^/]+)\//u.exec(globalThis.location.pathname)?.[1];
    if (build === undefined) throw new Error('The server worker runs outside a build folder');
    const path = serverPackBookPath(build);
    const book = readServerPackBook(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await serverBytes(new URL(`/${path}`, root), path))));
    const pack = book.shards[slug];
    if (pack === undefined) throw new Error(`No server pack for ${slug}`);
    return { pack, body: await serverBytes(new URL(pack.url, root), pack.url) };
  };
  return async path => {
    const { pack, body } = await (opened ??= open()), bytes = serverPackFile(pack, body, path);
    if (bytes === undefined) throw new Error(`Missing server input ${path}`);
    return bytes;
  };
}

/**
 * P1-E5.2: the worker's product reader, loadHeadlessProduct over `fetch`. It verifies the same index, sizes and SHA-256
 * addresses with the same checks; only where the bytes come from differs.
 */
export async function fetchServerProduct(base: string, rapier: Rapier, held?: HeldRead): Promise<HeadlessRuntimeInput> {
  const root = new URL(base, globalThis.location.href).href, slug = new URL('.', root).pathname.split('/').at(-2) ?? '';
  // C2: the server class sits outside the tree a client reads (J91), in one pack this build's book names.
  const serverFile = serverPackReader(root, slug);
  const read = (path: string): Promise<Uint8Array> => path.startsWith('server/') ? serverFile(path) : serverBytes(new URL(path, root), path, held);
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read('shard.json')));
  if (!isOutputIndex(input)) throw new Error('Standalone needs a format-2 output');
  const assembled = await resolveOutputDescriptor(input, { offline: false, hash: contentHash, read, checks: nodeOutputDescriptorChecks });
  const shard = parseShardfile(assembled);
  carryOutputDescriptor(assembled, shard);
  const descriptor = outputDescriptor(shard);
  if (descriptor === undefined) throw new Error('Standalone output has no verified index');
  const files = new Map<string, { readonly path: string; readonly hash: string; readonly bytes: number }>();
  for (const file of descriptor.index.files) files.set(file.commons === true ? `commons:${file.hash}` : file.hash, { path: file.path, hash: file.hash, bytes: file.compressed });
  for (const file of descriptor.index.admission.server ?? []) files.set(file.hash, { path: file.path, hash: file.hash, bytes: file.bytes });
  const verified = async (ref: string): Promise<Uint8Array> => {
    const file = files.get(ref);
    if (file === undefined) throw new Error('Undeclared server input');
    const bytes = await read(file.path);
    if (bytes.length !== file.bytes || await contentHash(bytes) !== file.hash) throw new Error('Server input hash or size mismatch');
    return bytes;
  };
  const product = shardProductData(shard, root, verified, true, false, nodeNamedJsonCheck, { files: true });
  const assets = new Map<string, Uint8Array>();
  // E5.2b: only what a server reads, and of that only what it asks for by hash: a named file is fetched when the product is asked
  // for it. Everything else is the page's, and every byte here would be a phone's.
  await Promise.all(descriptor.index.files.filter(file => serverReadsFile(file, shard.terrain?.collider) && (file.name === undefined || file.kind === 'wasm' || file.kind === 'tile')).map(async file => { const ref = file.commons === true ? `commons:${file.hash}` : file.hash; assets.set(ref, await verified(ref)); }));
  return { shard, assets, rapier, product };
}
