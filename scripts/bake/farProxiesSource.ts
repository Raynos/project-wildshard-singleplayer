// SHARD-PLATFORM SF23: bake every grid shard's far proxy from its baked terrain (public/assets/baked/<slug>/terrain.bin)
// and its own far look (src/shards/<slug>/look/far.ts), plus its model parts where its land is models (SF49), into public/assets/baked/<slug>/far.glb + far.json. The look
// closures run only here; the client reads the GLB (one draw, region in TEXCOORD_0.x) and far.json's row and look.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MeshStandardMaterial } from 'three';
import { CONTENT_CAPS } from '../../src/engine/core/config';
import { parseBakedTerrain } from '../../src/engine/world/BakedTerrain';
import { decodeTerrainTile } from '../../src/engine/world/terrainTileData';
import { buildFarProxy, type FarGrid, type FarLookRuntime, type FarLookSource, type FarPart } from '../../src/game/grid/farProxy';
import { farProxyGeometry } from '../../src/game/grid/farView';
import type { Shardfile } from '../../src/game/shardfile/schema';
import { parseGlb } from '../../src/sdk/assets';
import { staticGlb } from '../../src/sdk/bake/glb';
import { canonicalJson, contentHash } from '../../src/sdk/project';
import { farLook as template } from '../../src/shards/_template/generators/farLook';
import { farLook as driftwood } from '../../src/shards/driftwood-isle/look/far';
import { farGrid as farReachGrid, farLook as farReach, farParts as farReachParts } from '../../src/shards/far-reach/generators/farLook';
import { farLook as inkCel } from '../../src/shards/ink-cel-valley/generators/farLook';
import { farLook as nalati } from '../../src/shards/nalati-grasslands/look/far';
import { farGrid as nineDragonGrid, farLook as nineDragon } from '../../src/shards/nine-dragon-stack/look/far';
import { farLook as pastel } from '../../src/shards/pastel-plain/generators/farLook';
import { farLook as pineHollow } from '../../src/shards/pine-hollow/look/far';
import { farLook as sunscar } from '../../src/shards/sunscar-dunes/generators/farLook';

/** The grid's shards (§3.3: shipped + dev mode + the DEVSERVER cell). */
export const FAR_LOOKS: Readonly<Record<string, FarLookSource>> = { '_template': template, 'driftwood-isle': driftwood, 'pine-hollow': pineHollow, 'nalati-grasslands': nalati, 'sunscar-dunes': sunscar, 'far-reach': farReach, 'nine-dragon-stack': nineDragon,
  'pastel-plain': pastel, 'ink-cel-valley': inkCel };
/** Structure-first shards with no `terrain.bin` bake from a grid their far look builds (Nine Dragon's skyline, G95). */
export const FAR_GRIDS: Readonly<Partial<Record<string, () => FarGrid>>> = { 'nine-dragon-stack': nineDragonGrid, 'far-reach': farReachGrid };
/**
 * Terrain shardfile projects with no repo `terrain.bin` (SF59's fixture shards) bake from their own shardfile terrain
 * collider (`shardfileGrid`): without a far proxy their grid cells stay "loading" and the rings never report ready.
 */
export const FAR_SHARDFILE_TERRAIN: readonly string[] = ['pastel-plain', 'ink-cel-valley'];
/**
 * What the far-proxies runner hands a shard's model parts (SF49): `model` reads a committed GLB (repo-relative path)
 * welded by position, its base colour sampled per vertex (linear RGB); `decimate` simplifies an index over the same
 * positions toward a triangle count (meshoptimizer), so a shard's islands go into its proxy as decimated models.
 */
export interface FarModelTools {
  readonly model: (path: string) => Promise<{ readonly positions: Float32Array; readonly colours: Float32Array; readonly index: Uint32Array }>;
  readonly decimate: (positions: Float32Array, index: Uint32Array, triangles: number) => Uint32Array;
}
/** Shards whose land is models (Sky Reach's floating islands, SF49) merge them into their proxy. */
export const FAR_PARTS: Readonly<Partial<Record<string, (tools: FarModelTools) => Promise<readonly FarPart[]>>>> = { 'far-reach': farReachParts };
/** far.json: the shardfile `far` row, the GLB's file row and the runtime look. */
export interface FarManifest { far: NonNullable<Shardfile['far']>; file: Shardfile['files'][number]; look: FarLookRuntime }

/** Bake one proxy: a single-draw GLB, refused over any §3.2 far cap. */
export function bakeFarProxy(grid: FarGrid, look: FarLookSource, parts: readonly FarPart[] = []): { manifest: FarManifest; bytes: Uint8Array } {
  const geometry = farProxyGeometry(buildFarProxy(grid, look, parts));
  const bytes = staticGlb([{ geometry, material: new MeshStandardMaterial({ color: 0xffffff, vertexColors: true }), castShadow: false }], 'far-proxy');
  const file: Shardfile['files'][number] = { hash: contentHash(bytes), kind: 'glb', compressed: bytes.length, ...parseGlb(bytes), dependencies: [], critical: false };
  geometry.computeBoundingBox(); const box = geometry.boundingBox; if (box === null) throw new Error('Missing far bounds');
  const far: NonNullable<Shardfile['far']> = { bounds: { min: box.min.toArray(), max: box.max.toArray() }, files: [file.hash], compressed: file.compressed, decoded: file.decoded, gpu: file.gpu, triangles: file.triangles, draws: file.draws };
  if (far.decoded + far.gpu > CONTENT_CAPS.far.resident || far.compressed > CONTENT_CAPS.far.compressed || far.triangles > CONTENT_CAPS.far.triangles || far.draws > CONTENT_CAPS.far.draws) throw new Error(`Far proxy exceeds content caps: ${JSON.stringify(far)}`);
  return { manifest: { far, file, look: { family: look.family, haze: look.haze, ...(look.grade === undefined ? {} : { grade: look.grade }), ...(look.band === undefined ? {} : { band: look.band }) } }, bytes };
}

/** Read a shard's baked terrain grid. */
export function farGrid(repo: string, slug: string): FarGrid {
  const raw = readFileSync(join(repo, 'public/assets/baked', slug, 'terrain.bin')), grid = parseBakedTerrain(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  if (grid === null) throw new Error(`${slug}: unreadable terrain.bin`);
  return { res: grid.res, size: grid.size, heights: grid.heights, splat: grid.splat.some((b, i) => i % 4 !== 0 && b > 0) ? grid.splat : null };
}

/**
 * Read a terrain shardfile project's height grid from its committed collider payload
 * (`src/shards/<slug>/data/terrain.json`'s `terrain.collider`, a terrain tile in `src/shards/<slug>/assets/`): the full
 * cell, centred on the cell origin, in the baked grid's lattice (`res` samples across `size` metres).
 */
export function shardfileGrid(repo: string, slug: string): FarGrid {
  const row: unknown = JSON.parse(readFileSync(join(repo, 'src/shards', slug, 'data/terrain.json'), 'utf8'));
  const terrain = typeof row === 'object' && row !== null && 'terrain' in row ? row.terrain : null;
  const collider = typeof terrain === 'object' && terrain !== null && 'collider' in terrain ? terrain.collider : null;
  if (typeof collider !== 'string') throw new Error(`${slug}: no shardfile terrain collider`);
  const tile = decodeTerrainTile(readFileSync(join(repo, 'src/shards', slug, 'assets', collider)));
  if (tile.x !== -tile.size / 2 || tile.z !== -tile.size / 2) throw new Error(`${slug}: terrain collider is not one centred cell`);
  return { res: tile.resolution, size: tile.size, heights: tile.heights, splat: null };
}

/** Bake and write every grid shard's proxy; returns the manifests by slug. */
export async function writeFarProxies(repo: string, tools: FarModelTools): Promise<Record<string, FarManifest>> {
  const out: Record<string, FarManifest> = {};
  for (const [slug, look] of Object.entries(FAR_LOOKS)) {
    const parts = await FAR_PARTS[slug]?.(tools) ?? [];
    const grid = FAR_GRIDS[slug]?.() ?? (FAR_SHARDFILE_TERRAIN.includes(slug) ? shardfileGrid(repo, slug) : farGrid(repo, slug));
    const { manifest, bytes } = bakeFarProxy(grid, look, parts), dir = join(repo, 'public/assets/baked', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'far.glb'), bytes); writeFileSync(join(dir, 'far.json'), canonicalJson(manifest)); out[slug] = manifest;
  }
  return out;
}
