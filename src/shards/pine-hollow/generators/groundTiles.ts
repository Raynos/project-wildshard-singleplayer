/**
 * Tile streaming P1 (G652): Pine Hollow's ground as 64 L0 + 16 L1 splat tiles (G227, `@wildshard/sdk/bake/splatGround`),
 * from its committed WSTR256 bake with the forest's canopy as a channel. L1 keeps a quarter of the native triangles within
 * a metre: the far ring's 125 m tiles are seen from 125 m out.
 */
import type { SplatGroundOptions } from '@wildshard/sdk/bake/splatGround';

/** The material name the ground primitives carry; Pine's `props.splat` row binds it. */
export const PINE_GROUND_MATERIAL = 'pine.ground';
export const PINE_GROUND: SplatGroundOptions = { material: PINE_GROUND_MATERIAL, lod1: { targetRatio: 0.25, maxErrorMetres: 1 } };

interface Cost { compressed: number; decoded: number; gpu: number; triangles: number; draws: number }
interface FileRow extends Cost { hash: string; kind: string; dependencies: string[]; critical: boolean }
interface TileRow extends Cost { lod: number; x: number; z: number; bounds: { min: number[]; max: number[] }; geometricError: number; files: string[] }
interface PropsTile { lod: number; x: number; z: number; file: string; additionalFiles?: string[] }
/** What `bake-pine-ground.mjs` writes (data/groundTiles.json). */
export interface PineGroundRows {
  splat: unknown;
  tiles: readonly { lod: number; x: number; z: number; bounds: { min: number[]; max: number[] }; geometricError: number; file: FileRow }[];
  textures: readonly FileRow[];
}

const lodOf = (lod: number): 0 | 1 => { if (lod !== 0 && lod !== 1) throw new Error('A ground tile is L0 or L1'); return lod; };
/**
 * The product's props and tile content with the ground joined: every one of the 80 tiles draws its ground GLB first (the
 * props tile `file`), the props already on that tile (Pine's timber) after it (`additionalFiles`); the tile rows carry both
 * files with their bounds unioned and their costs summed, and the ground GLBs and layer KTX2s join the files.
 */
export function withPineGround<P extends { tiles: readonly PropsTile[] }, S extends { tiles: readonly TileRow[]; files: readonly FileRow[] }>(
  props: P, shardfile: S, ground: PineGroundRows): { props: P & { splat: unknown; tiles: PropsTile[] }; shardfile: S & { tiles: TileRow[]; files: FileRow[] } } {
  const key = (row: { lod: number; x: number; z: number }): string => `${String(row.lod)}/${String(row.x)}/${String(row.z)}`;
  const propsTiles = new Map(props.tiles.map(row => [key(row), row])), contentTiles = new Map(shardfile.tiles.map(row => [key(row), row]));
  const covered = new Set(ground.tiles.map(key));
  for (const row of props.tiles) if (!covered.has(key(row))) throw new Error(`Pine props tile ${key(row)} has no ground tile`);
  const tiles = ground.tiles.map(row => {
    const prior = propsTiles.get(key(row)), content = contentTiles.get(key(row)), file = row.file;
    const extra = prior === undefined ? [] : [prior.file, ...prior.additionalFiles ?? []];
    const propsTile: PropsTile = { lod: lodOf(row.lod), x: row.x, z: row.z, file: file.hash, ...(extra.length === 0 ? {} : { additionalFiles: extra }) };
    const sum = (field: keyof Cost): number => file[field] + (content?.[field] ?? 0);
    const tile: TileRow = { lod: lodOf(row.lod), x: row.x, z: row.z, geometricError: Math.max(row.geometricError, content?.geometricError ?? 0),
      bounds: content === undefined ? row.bounds : { min: row.bounds.min.map((v, i) => Math.min(v, content.bounds.min[i] ?? v)), max: row.bounds.max.map((v, i) => Math.max(v, content.bounds.max[i] ?? v)) },
      files: [file.hash, ...content?.files ?? []], compressed: sum('compressed'), decoded: sum('decoded'), gpu: sum('gpu'), triangles: sum('triangles'), draws: sum('draws') };
    return { propsTile, tile };
  });
  return { props: { ...props, splat: ground.splat, tiles: tiles.map(row => row.propsTile) },
    shardfile: { ...shardfile, tiles: tiles.map(row => row.tile), files: [...shardfile.files, ...ground.tiles.map(row => row.file), ...ground.textures] } };
}
