/** DL22: the level files a boot reads before control that its spawn set did not carry (Pine's late models and props
 * tiles, recorded by a cold boot), kept by a stable identity so the list survives content edits: a props tile file by its
 * tile and slot, a file a section names by that section path (`ref:`), a file with a plain authored name by its name. A
 * name that carries a content hash is not stable (it changes with the bytes, sp-x8's review), so a recording keys such a
 * file by its section reference. The build maps identities back to the current hashes and refuses one it cannot resolve. */
export interface FenceReads {readonly version: 1; readonly files: readonly string[]}
interface IndexFile {readonly hash: string; readonly path?: string; readonly name?: string}
interface PropsTile {readonly lod: number; readonly x: number; readonly z: number; readonly file: string; readonly additionalFiles?: readonly string[]}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** A name without a content hash in it (8+ hex digits) stays the same when the file's bytes change. */
const stableName = (name: string): boolean => !/[a-f0-9]{8,}/u.test(name);
function propsTiles(sections: ReadonlyMap<string, unknown>): readonly PropsTile[] {
  const section = sections.get('world/props'), props = object(section) ? section['props'] : undefined, tiles = object(props) ? props['tiles'] : undefined;
  if (!Array.isArray(tiles)) return [];
  return tiles.filter((row: unknown): row is PropsTile => object(row) && typeof row['file'] === 'string' && typeof row['lod'] === 'number'
    && typeof row['x'] === 'number' && typeof row['z'] === 'number');
}
const tileSlots = (tile: PropsTile): readonly (readonly [string, string])[] =>
  [[`props-tile:${tile.lod}/${tile.x}/${tile.z}:file`, tile.file], ...(tile.additionalFiles ?? []).map((hash, at) => [`props-tile:${tile.lod}/${tile.x}/${tile.z}:${at}`, hash] as const)];
/** Every identity each file has in this product, best first: props tile slots, plain names, section references. A file
 *  several rows name has several identities (sp-x8: an alias must still resolve when its sibling changes). */
export function fenceReadIdentities(files: readonly IndexFile[], sections: ReadonlyMap<string, unknown>): ReadonlyMap<string, readonly string[]> {
  const identities = new Map<string, string[]>(), add = (hash: string, identity: string): void => {
    const list = identities.get(hash) ?? []; if (!list.includes(identity)) list.push(identity); identities.set(hash, list);
  };
  for (const tile of propsTiles(sections)) for (const [identity, hash] of tileSlots(tile)) add(hash, identity);
  for (const file of files) if (file.name !== undefined && stableName(file.name)) add(file.hash, `name:${file.name}`);
  // A section names a file by its hash, path or name: each first place is a `ref:` identity.
  const byText = new Map<string, string>();
  for (const file of files) for (const text of [file.hash, file.path, file.name]) if (text !== undefined) byText.set(text, file.hash);
  // The path is a JSON Pointer (RFC 6901: '~' -> '~0', '/' -> '~1'), so a key 'a.b' and a.b never collide (sp-x8's
  // review). An array index is part of the path: reordering rows changes the identity, and the build refuses it as stale.
  const segment = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');
  const walk = (value: unknown, at: string): void => {
    if (typeof value === 'string') { const hash = byText.get(value); if (hash !== undefined) add(hash, `ref:${at}`); return; }
    if (Array.isArray(value)) { value.forEach((item: unknown, row) => { walk(item, `${at}/${row}`); }); return; }
    if (object(value)) for (const [key, item] of Object.entries(value)) walk(item, `${at}/${segment(key)}`);
  };
  for (const [name, value] of sections) walk(value, `${name}:`);
  // A name with a content hash still resolves (lists recorded before it was skipped), last: when the bytes change the
  // name goes, and the build refuses the stale entry instead of quietly fetching it on demand again.
  for (const file of files) if (file.name !== undefined && !stableName(file.name)) add(file.hash, `name:${file.name}`);
  return identities;
}
/** The current hashes of a recorded list's identities, and the identities this product no longer has. */
export function resolveFenceReads(reads: FenceReads, files: readonly IndexFile[], sections: ReadonlyMap<string, unknown>): {readonly hashes: ReadonlySet<string>; readonly unresolved: readonly string[]} {
  const byIdentity = new Map<string, string>();
  for (const [hash, identities] of fenceReadIdentities(files, sections)) for (const identity of identities) if (!byIdentity.has(identity)) byIdentity.set(identity, hash);
  const hashes = new Set<string>(), unresolved: string[] = [];
  for (const identity of reads.files) { const hash = byIdentity.get(identity); if (hash === undefined) unresolved.push(identity); else hashes.add(hash); }
  return {hashes, unresolved};
}
/** The identity a recording keeps for a file: its first (most stable) one. */
export function fenceReadIdentity(identities: ReadonlyMap<string, readonly string[]>, hash: string): string | undefined { return identities.get(hash)?.[0]; }
/** Every identity a recording keeps for a file, so a later split of a shared file (two rows naming one hash) leaves an
 *  entry that no longer resolves to the same file, and the build refuses it as stale (sp-x8's review). */
export function fenceReadAliases(identities: ReadonlyMap<string, readonly string[]>, hash: string): readonly string[] { return identities.get(hash) ?? []; }
/** A `/assets` file's path without its content hash or version query: `/assets/sfx/best/bed-forest-2-0cd11be5.m4a` →
 *  `/assets/sfx/best/bed-forest-2.m4a`, `/assets/gpu/x/rifle.phone-fd73a325.glb` → `/assets/gpu/x/rifle.phone.glb`. */
export function assetStem(url: string): string {
  const path = url.split('?')[0] ?? url, at = path.lastIndexOf('/');
  return path.slice(0, at + 1) + path.slice(at + 1).replace(/[-.][a-f0-9]{8,}(?=\.[a-z0-9]+$)/u, '');
}
/** DL22 (Pine's 54.8 MB of `/assets` reads after its spawn download): each `/assets` URL's identity. A pack part is
 *  `asset-pack:<bank>:<pack>:<part>` from the boot asset tables (`packParts`: part URL → that identity; parts share a
 *  stem); any other file is `asset:<stem>` when no other file has that stem. */
export function assetIdentities(urls: readonly string[], packParts: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const stems = new Map<string, string[]>();
  for (const url of urls) if (!packParts.has(url.split('?')[0] ?? url)) { const stem = assetStem(url); stems.set(stem, [...stems.get(stem) ?? [], url]); }
  const identities = new Map<string, string>();
  for (const url of urls) {
    const path = url.split('?')[0] ?? url, pack = packParts.get(path);
    if (pack !== undefined) { identities.set(url, pack); continue; }
    const same = stems.get(assetStem(url)) ?? [];
    if (same.length === 1) identities.set(url, `asset:${assetStem(url)}`);
  }
  return identities;
}
/** Pack part URL → identity, from a boot asset table's `packs` (bank → pack name → {parts: [{url}]}). */
export function packPartIdentities(packs: unknown): ReadonlyMap<string, string> {
  const parts = new Map<string, string>();
  if (!object(packs)) return parts;
  for (const [bank, named] of Object.entries(packs)) {
    if (!object(named)) continue;
    for (const [pack, def] of Object.entries(named)) {
      const rows = object(def) && Array.isArray(def['parts']) ? def['parts'] : [];
      rows.forEach((row: unknown, at) => { if (object(row) && typeof row['url'] === 'string') parts.set(row['url'], `asset-pack:${bank}:${pack}:${at}`); });
    }
  }
  return parts;
}
/** A committed list, checked. */
export function readFenceReads(input: unknown): FenceReads {
  const files: unknown = object(input) ? input['files'] : undefined;
  if (!object(input) || input['version'] !== 1 || !Array.isArray(files) || files.length > 20_000
    || !files.every((row: unknown): row is string => typeof row === 'string'
      && /^(?:name:.+|ref:[^:]+:.+|props-tile:\d+\/\d+\/\d+:(?:file|\d+)|asset:\/assets\/[^?]+|asset-pack:[^:]+:[^:]+:\d+)$/u.test(row))) throw new Error('Invalid fence reads');
  return {version: 1, files: [...new Set(files)].sort()};
}
