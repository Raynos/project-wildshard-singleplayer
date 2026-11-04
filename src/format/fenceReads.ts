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
/** A stem that still carries a hash (a pure-hash basename like `cabin-materials/<64 hex>.glb`, or a bundler's base64
 *  suffix) changes with the bytes: it is no identity (sp-x8's review). */
function stableStem(stem: string): boolean {
  const name = stem.slice(stem.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/u, '');
  return !/[a-f0-9]{8,}/u.test(name) && !/-(?=[A-Za-z0-9_-]{8}$)(?=.*[0-9A-Z])[A-Za-z0-9_-]{8}$/u.test(name);
}
/** Where the sections name each of `paths` (a JSON Pointer `ref:<section>:<pointer>`), first place first. */
export function sectionRefs(sections: ReadonlyMap<string, unknown>, paths: ReadonlySet<string>): ReadonlyMap<string, string> {
  const refs = new Map<string, string>(), segment = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');
  const walk = (value: unknown, at: string): void => {
    if (typeof value === 'string') { const path = value.split('?')[0] ?? value; if (paths.has(path) && !refs.has(path)) refs.set(path, `ref:${at}`); return; }
    if (Array.isArray(value)) { value.forEach((item: unknown, row) => { walk(item, `${at}/${row}`); }); return; }
    if (object(value)) for (const [key, item] of Object.entries(value)) walk(item, `${at}/${segment(key)}`);
  };
  for (const [name, value] of sections) walk(value, `${name}:`);
  return refs;
}
/** A boot asset table's pack parts (`packs`: bank → pack → {parts: [{url, files: [[path, …]]}]}): each part URL and the
 *  identity of every member file in it, `asset-pack-member:<bank>:<pack>:<member stem>`. A pack is named by its members,
 *  not its part ordinal, so a member a rebuild moves to another part re-resolves to that part, and a member that is gone
 *  leaves a stale entry (sp-x8's review). */
export function packMembers(packs: unknown): ReadonlyMap<string, readonly string[]> {
  const parts = new Map<string, string[]>();
  if (!object(packs)) return parts;
  for (const [bank, named] of Object.entries(packs)) {
    if (!object(named)) continue;
    for (const [pack, def] of Object.entries(named)) {
      for (const row of object(def) && Array.isArray(def['parts']) ? def['parts'] : []) {
        if (!object(row) || typeof row['url'] !== 'string' || !Array.isArray(row['files'])) continue;
        const members = row['files'].flatMap((file: unknown) => Array.isArray(file) && typeof file[0] === 'string' ? [`asset-pack-member:${bank}:${pack}:${assetStem(file[0])}`] : []);
        parts.set(row['url'], [...parts.get(row['url']) ?? [], ...members]);
      }
    }
  }
  return parts;
}
/** DL22 (Pine's 54.8 MB of `/assets` reads after its spawn download): each `/assets` URL's identities. A pack part is
 *  its members' identities (`packMembers`); any other file is `asset:<stem>` when its stem is hash-free and no other
 *  file shares it, else where a section names it (`refs`); a file with neither has none, and a recording refuses it. */
export function assetIdentities(urls: readonly string[], packs: ReadonlyMap<string, readonly string[]>, refs: ReadonlyMap<string, string> = new Map()): ReadonlyMap<string, readonly string[]> {
  const stems = new Map<string, number>();
  for (const url of urls) if (!packs.has(url.split('?')[0] ?? url)) { const stem = assetStem(url); stems.set(stem, (stems.get(stem) ?? 0) + 1); }
  const identities = new Map<string, readonly string[]>();
  for (const url of urls) {
    const path = url.split('?')[0] ?? url, members = packs.get(path), stem = assetStem(url);
    if (members !== undefined) { if (members.length > 0) identities.set(url, members); continue; }
    if (stableStem(stem) && stems.get(stem) === 1) { identities.set(url, [`asset:${stem}`]); continue; }
    const ref = refs.get(path);
    if (ref !== undefined) identities.set(url, [ref]);
  }
  return identities;
}
/** A committed list, checked. */
export function readFenceReads(input: unknown): FenceReads {
  const files: unknown = object(input) ? input['files'] : undefined;
  if (!object(input) || input['version'] !== 1 || !Array.isArray(files) || files.length > 20_000
    || !files.every((row: unknown): row is string => typeof row === 'string'
      && /^(?:name:.+|ref:[^:]+:.+|props-tile:\d+\/\d+\/\d+:(?:file|\d+)|asset:\/assets\/[^?]+|asset-pack-member:[^:]+:[^:]+:\/assets\/[^?]+)$/u.test(row))) throw new Error('Invalid fence reads');
  return {version: 1, files: [...new Set(files)].sort()};
}
