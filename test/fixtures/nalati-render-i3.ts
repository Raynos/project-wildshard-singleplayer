// oxlint-disable-next-line import/no-nodejs-modules -- the committed terrain input feeds the exact offline source constructor.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare metadata bytes natively.
import { Buffer } from 'node:buffer';
import { nalatiRenderTileSources } from '../../src/shards/nalati-grasslands/generators/renderTileSources';

/** iPhone downloads I3's predecessor layer (as T8's in nalati-render-header.ts): the shipped Nalati render metadata is the
 *  pinned pre-I3 one with some L0 ground tiles in phone geometry. Every row equals the pre-I3 row but for a compacted L0
 *  tile's file hash and its byte costs (compressed, decoded, gpu); triangles, draws, bounds, dependencies and every L1 row
 *  stay exact. `renamed` maps each pre-I3 hash to its I3 hash. Throws ("complete source pin") on any other difference. */
export function i3Predecessor(exactBytes: Uint8Array, metadata: Uint8Array): { renamed: Map<string, string>; metadata: Uint8Array } {
  const renamed = new Map<string, string>();
  if (Buffer.compare(Buffer.from(exactBytes), Buffer.from(metadata)) === 0) return { renamed, metadata: exactBytes };
  const refuse = (label: string): never => { throw new Error(`Nalati render metadata differs from its complete source pin (I3: ${label})`); };
  const parse = (bytes: Uint8Array): Metadata => {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Metadata; } catch { return refuse('not JSON'); }
  };
  const exact = parse(exactBytes), current = parse(metadata), costs = ['compressed', 'decoded', 'gpu'];
  const without = (row: Readonly<Record<string, unknown>>, keys: readonly string[]): string => JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key))));
  if (exact.version !== current.version || exact.tiles.length !== current.tiles.length || exact.files.length !== current.files.length) refuse('inventory');
  exact.tiles.forEach((tile, index) => {
    const next = current.tiles[index];
    if (next === undefined || next.files.length !== tile.files.length) return refuse(`tile ${index}`);
    const changed = tile.files.some((hash, i) => next.files[i] !== hash);
    if (changed && tile.lod !== 0) refuse(`L${tile.lod} tile ${tile.x},${tile.z}`);
    if (without(next, changed ? ['files', ...costs] : []) !== without(tile, changed ? ['files', ...costs] : [])) refuse(`tile ${tile.lod}:${tile.x}:${tile.z}`);
    tile.files.forEach((hash, i) => { const to = next.files[i]; if (to !== undefined && to !== hash) renamed.set(hash, to); });
  });
  const files = new Map(current.files.map(file => [file.hash, file]));
  for (const file of exact.files) {
    const next = files.get(renamed.get(file.hash) ?? file.hash);
    if (next === undefined || without(next, renamed.has(file.hash) ? ['hash', ...costs] : []) !== without(file, renamed.has(file.hash) ? ['hash', ...costs] : [])) refuse(`file ${file.hash}`);
  }
  const props = JSON.stringify({ ...current.props, tiles: current.props.tiles.map(tile => {
    const back = [...renamed].find(([, to]) => to === tile.file)?.[0];
    return back === undefined ? tile : { ...tile, file: back };
  }) });
  if (props !== JSON.stringify(exact.props)) refuse('bindings');
  return { renamed, metadata: exactBytes };
}

interface Metadata {
  readonly version: number;
  readonly tiles: readonly (Readonly<Record<string, unknown>> & { readonly lod: number; readonly x: number; readonly z: number; readonly files: readonly string[] })[];
  readonly files: readonly (Readonly<Record<string, unknown>> & { readonly hash: string })[];
  readonly props: Readonly<Record<string, unknown>> & { readonly tiles: readonly (Readonly<Record<string, unknown>> & { readonly file: string })[] };
}

/** The pre-I3 render metadata, built once from the committed terrain (the same exact construction the source pins hold). */
export const EXACT_RENDER_METADATA: Uint8Array = await (async () => {
  const built = await nalatiRenderTileSources(new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')), 'exact');
  const bytes = built.files.get('data/renderTiles.json');
  if (bytes === undefined) throw new Error('Missing pre-I3 Nalati render metadata');
  return bytes;
})();
