import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { bakeNalatiWorldRows } from './nalatiWorldRows';
import { bakeNalatiGroundQuads, nalatiGroundSource } from './nalatiGroundSource';

/** Existing N1b policy: preserve the original 1 m appearance error and paired L1 layout. */
const L1_POLICY = { targetRatio: 0.1, maxErrorMetres: 1 };
export interface NalatiRenderTileSources {
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly tiles: number;
  readonly nativeGround: string;
  readonly bytes: number;
}

/** Construct the retained render-tile publication from explicit native terrain bytes.
 * No filesystem, generated metadata, cache or publication is installed by importing this module. */
export async function nalatiRenderTileSources(native: Uint8Array): Promise<NalatiRenderTileSources> {
  const { assets, nativeGround, ...rows } = bakeNalatiWorldRows(native, [], 'painterly', undefined, [0]);
  const tiles = new Set(rows.tiles.flatMap(tile => tile.files));
  const metadata = new TextEncoder().encode(`${JSON.stringify({ version: 1, tiles: rows.tiles,
    files: rows.files.filter(file => tiles.has(file.hash)), props: rows.props })}\n`);
  const files = new Map<string, Uint8Array>([['data/renderTiles.json', metadata]]);
  for (const quad of await bakeNalatiGroundQuads(nalatiGroundSource(native), L1_POLICY)) {
    if (quad.bytes.byteLength >= 1_000_000) throw new Error(`Nalati L1 pair ${quad.x}.${quad.z} is ${quad.bytes.byteLength} bytes (>= 1 MB)`);
    files.set(`assets/world-terrain/ground-l1-${quad.x}-${quad.z}.generated.glb`, quad.bytes);
  }
  for (const [hash, bytes] of assets) {
    if (!tiles.has(hash)) continue;
    if (hashImmutableBytes(bytes) !== hash) throw new Error('Nalati render tile differs from its hash');
    files.set(`assets/${hash}`, bytes);
  }
  return { files, tiles: rows.tiles.length, nativeGround: nativeGround.file,
    bytes: [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0) };
}
