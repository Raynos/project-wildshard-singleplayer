/** DL5 (download mini plan): pack the spawn manifests' files into shared, content-named parts.
 *
 * Parts are shared, never per manifest: the 112 manifests sum to 2.6 GB against 374 MB of distinct files. Files are
 * grouped by which public phone entries need them (client, and grid mode 000), so a part holds only bytes those
 * entries read together; files no public entry needs group by every manifest that lists them. While a public entry
 * still needs more than PART_TARGET parts, its two smallest groups merge, but only when no public entry's over-fetch
 * passes OVER_FETCH of its own bytes. Each group is cut into parts of at most PART_BYTES raw, never inside a file.
 * A part is the raw member bodies on 16-byte boundaries, named by its sha256; the offsets live in each manifest. */
import {createHash} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {SPAWN_PART_ALIGN, type SpawnFile, type SpawnPart} from '../../src/format/spawnManifest';

export const PART_BYTES = 12_000_000, PART_TARGET = 10, OVER_FETCH = 0.1;
export interface SpawnPartInput {readonly rows: readonly SpawnFile[]; readonly public: boolean}
interface Group {readonly key: string; readonly members: ReadonlySet<number>; readonly urls: string[]; bytes: number}

const align = (at: number): number => Math.ceil(at / SPAWN_PART_ALIGN) * SPAWN_PART_ALIGN;
/** The groups after the steered merge (exported for the census and tests). */
export function spawnPartGroups(manifests: readonly SpawnPartInput[]): Group[] {
  const need = new Map<string, Set<number>>(), size = new Map<string, number>(), order: string[] = [];
  manifests.forEach((manifest, index) => {
    for (const row of manifest.rows) {
      const previous = size.get(row.url);
      if (previous !== undefined && previous !== row.bytes) throw new Error(`Spawn file sizes differ: ${row.url}`);
      if (previous === undefined) { size.set(row.url, row.bytes); order.push(row.url); }
      let set = need.get(row.url); if (set === undefined) { set = new Set(); need.set(row.url, set); } set.add(index);
    }
  });
  const isPublic = (index: number): boolean => manifests[index]?.public === true;
  const groups = new Map<string, Group>();
  for (const url of order) {
    const all = need.get(url) ?? new Set<number>(), wanted = [...all].filter(isPublic);
    const members = new Set(wanted.length > 0 ? wanted : all), key = `${wanted.length > 0 ? 'P' : 'X'}:${[...members].sort((a, b) => a - b).join(',')}`;
    let group = groups.get(key); if (group === undefined) { group = {key, members, urls: [], bytes: 0}; groups.set(key, group); }
    group.urls.push(url); group.bytes += size.get(url) ?? 0;
  }
  const publicIndices = manifests.flatMap((manifest, index) => manifest.public ? [index] : []);
  const own = new Map(publicIndices.map(index => [index, manifests[index]?.rows.reduce((sum, row) => sum + row.bytes, 0) ?? 0]));
  const over = new Map(publicIndices.map(index => [index, 0]));
  const partsOf = (group: Group): number => Math.max(1, Math.ceil(group.bytes / PART_BYTES));
  const needs = (index: number): number => [...groups.values()].reduce((sum, group) => sum + (group.members.has(index) ? partsOf(group) : 0), 0);
  for (;;) {
    const worst = publicIndices.reduce<number | undefined>((best, index) => best === undefined || needs(index) > needs(best) ? index : best, undefined);
    if (worst === undefined || needs(worst) <= PART_TARGET) break;
    const mine = [...groups.values()].filter(group => group.key.startsWith('P:') && group.members.has(worst)).sort((a, b) => a.bytes - b.bytes);
    let merged = false;
    for (const small of mine) {
      for (const other of mine) {
        if (other === small) continue;
        const extra = new Map<number, number>();
        for (const index of small.members) if (!other.members.has(index)) extra.set(index, other.bytes);
        for (const index of other.members) if (!small.members.has(index)) extra.set(index, small.bytes);
        if (![...extra].every(([index, bytes]) => (over.get(index) ?? 0) + bytes <= OVER_FETCH * (own.get(index) ?? 0))) continue;
        for (const [index, bytes] of extra) over.set(index, (over.get(index) ?? 0) + bytes);
        const members = new Set([...small.members, ...other.members]), key = `P:${[...members].sort((a, b) => a - b).join(',')}`;
        groups.delete(small.key); groups.delete(other.key);
        const joined = groups.get(key) ?? {key, members, urls: [], bytes: 0};
        joined.urls.push(...small.urls, ...other.urls); joined.bytes += small.bytes + other.bytes; groups.set(key, joined);
        merged = true; break;
      }
      if (merged) break;
    }
    if (!merged) break;
  }
  return [...groups.values()];
}

/** Write every part under `outDir/assets/spawn/parts/` and return each manifest's part table (same order as input). */
export function writeSpawnParts(outDir: string, manifests: readonly SpawnPartInput[], read: (url: string) => Uint8Array): SpawnPart[][] {
  const placed = new Map<string, {url: string; bytes: number; hash: string; offset: number}>(), written: {url: string; bytes: number; hash: string}[] = [];
  mkdirSync(join(outDir, 'assets/spawn/parts'), {recursive: true});
  const sizes = new Map(manifests.flatMap(manifest => manifest.rows.map(row => [row.url, row.bytes] as const)));
  for (const group of spawnPartGroups(manifests)) {
    let batch: string[] = [], at = 0;
    const flush = (): void => {
      if (batch.length === 0) return;
      const body = new Uint8Array(at), offsets = new Map<string, number>(); let cursor = 0;
      for (const url of batch) {
        cursor = align(cursor); const bytes = read(url);
        if (bytes.length !== sizes.get(url)) throw new Error(`Spawn part member size differs: ${url}`);
        body.set(bytes, cursor); offsets.set(url, cursor); cursor += bytes.length;
      }
      const hash = createHash('sha256').update(body).digest('hex'), url = `/assets/spawn/parts/${hash.slice(0, 16)}.pack`;
      writeFileSync(join(outDir, url.slice(1)), body);
      for (const [member, offset] of offsets) placed.set(member, {url, bytes: body.length, hash, offset});
      written.push({url, bytes: body.length, hash}); batch = []; at = 0;
    };
    for (const url of group.urls) {
      const bytes = sizes.get(url) ?? 0, end = align(at) + bytes;
      if (batch.length > 0 && end > PART_BYTES) flush();
      at = align(at) + bytes; batch.push(url);
    }
    flush();
  }
  return manifests.map(manifest => {
    const parts = new Map<string, {url: string; bytes: number; hash: string; members: [number, number][]}>();
    manifest.rows.forEach((row, index) => {
      const at = placed.get(row.url); if (at === undefined) throw new Error(`Spawn file outside every part: ${row.url}`);
      let part = parts.get(at.url); if (part === undefined) { part = {url: at.url, bytes: at.bytes, hash: at.hash, members: []}; parts.set(at.url, part); }
      part.members.push([index, at.offset]);
    });
    for (const part of parts.values()) part.members.sort((a, b) => a[1] - b[1]);
    return [...parts.values()];
  });
}
