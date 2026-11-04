/** DL22: the level files a boot reads before control that its spawn set did not carry (Pine's late models and props
 * tiles, recorded by a cold boot), kept by a stable identity so the list survives content edits: a named file by its
 * name, a props tile file by its tile and slot. The build maps the identities back to the current hashes. */
export interface FenceReads {readonly version: 1; readonly files: readonly string[]}
interface IndexFile {readonly hash: string; readonly name?: string}
interface PropsTile {readonly lod: number; readonly x: number; readonly z: number; readonly file: string; readonly additionalFiles?: readonly string[]}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function propsTiles(sections: ReadonlyMap<string, unknown>): readonly PropsTile[] {
  const section = sections.get('world/props'), props = object(section) ? section['props'] : undefined, tiles = object(props) ? props['tiles'] : undefined;
  if (!Array.isArray(tiles)) return [];
  return tiles.filter((row: unknown): row is PropsTile => object(row) && typeof row['file'] === 'string' && typeof row['lod'] === 'number'
    && typeof row['x'] === 'number' && typeof row['z'] === 'number');
}
const tileSlots = (tile: PropsTile): readonly (readonly [string, string])[] =>
  [[`props-tile:${tile.lod}/${tile.x}/${tile.z}:file`, tile.file], ...(tile.additionalFiles ?? []).map((hash, at) => [`props-tile:${tile.lod}/${tile.x}/${tile.z}:${at}`, hash] as const)];
/** Each file's stable identity in this product (`name:<name>`, `props-tile:<lod>/<x>/<z>:<slot>`); unidentifiable files are absent. */
export function fenceReadIdentities(files: readonly IndexFile[], sections: ReadonlyMap<string, unknown>): ReadonlyMap<string, string> {
  const identities = new Map<string, string>();
  for (const tile of propsTiles(sections)) for (const [identity, hash] of tileSlots(tile)) if (!identities.has(hash)) identities.set(hash, identity);
  for (const file of files) if (file.name !== undefined && !identities.has(file.hash)) identities.set(file.hash, `name:${file.name}`);
  return identities;
}
/** The current hashes of a recorded list's identities in this product (an identity the product no longer has is skipped). */
export function fenceReadHashes(reads: FenceReads, files: readonly IndexFile[], sections: ReadonlyMap<string, unknown>): ReadonlySet<string> {
  const byIdentity = new Map([...fenceReadIdentities(files, sections)].map(([hash, identity]) => [identity, hash]));
  const hashes = new Set<string>();
  for (const identity of reads.files) { const hash = byIdentity.get(identity); if (hash !== undefined) hashes.add(hash); }
  return hashes;
}
/** A committed list, checked. */
export function readFenceReads(input: unknown): FenceReads {
  const files: unknown = object(input) ? input['files'] : undefined;
  if (!object(input) || input['version'] !== 1 || !Array.isArray(files) || files.length > 20_000
    || !files.every((row: unknown): row is string => typeof row === 'string' && /^(?:name:|props-tile:\d+\/\d+\/\d+:(?:file|\d+)$)/u.test(row))) throw new Error('Invalid fence reads');
  return {version: 1, files: [...new Set(files)].sort()};
}
