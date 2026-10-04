// SHARD-PLATFORM SF23: bake every grid shard's far proxy from its baked terrain (public/assets/baked/<slug>/terrain.bin)
// and its own far look (src/shards/<slug>/look/far.ts) into public/assets/baked/<slug>/far.glb + far.json. The look
// closures run only here; the client reads the GLB (one draw, region in TEXCOORD_0.x) and far.json's row and look.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MeshStandardMaterial } from 'three';
import { CONTENT_CAPS } from '../../src/engine/core/config';
import { parseBakedTerrain } from '../../src/engine/world/BakedTerrain';
import { buildFarProxy, type FarGrid, type FarLookRuntime, type FarLookSource } from '../../src/game/grid/farProxy';
import { farProxyGeometry } from '../../src/game/grid/farView';
import type { Shardfile } from '../../src/game/shardfile/schema';
import { parseGlb } from '../../src/sdk/assets';
import { staticGlb } from '../../src/sdk/bake/glb';
import { canonicalJson, contentHash } from '../../src/sdk/project';
import { farLook as template } from '../../src/shards/_template/generators/farLook';
import { farLook as driftwood } from '../../src/shards/driftwood-isle/look/far';
import { farLook as farReach } from '../../src/shards/far-reach/look/far';
import { farLook as nalati } from '../../src/shards/nalati-grasslands/look/far';
import { farLook as pineHollow } from '../../src/shards/pine-hollow/look/far';
import { farLook as sunscar } from '../../src/shards/sunscar-dunes/look/far';

/** The grid's shards (§3.3: shipped + dev mode). */
export const FAR_LOOKS: Readonly<Record<string, FarLookSource>> = { '_template': template, 'driftwood-isle': driftwood, 'pine-hollow': pineHollow, 'nalati-grasslands': nalati, 'sunscar-dunes': sunscar, 'far-reach': farReach };
/** far.json: the shardfile `far` row, the GLB's file row and the runtime look. */
export interface FarManifest { far: NonNullable<Shardfile['far']>; file: Shardfile['files'][number]; look: FarLookRuntime }

/** Bake one proxy: a single-draw GLB, refused over any §3.2 far cap. */
export function bakeFarProxy(grid: FarGrid, look: FarLookSource): { manifest: FarManifest; bytes: Uint8Array } {
  const geometry = farProxyGeometry(buildFarProxy(grid, look));
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

/** Bake and write every grid shard's proxy; returns the manifests by slug. */
export function writeFarProxies(repo: string): Record<string, FarManifest> {
  const out: Record<string, FarManifest> = {};
  for (const [slug, look] of Object.entries(FAR_LOOKS)) {
    const { manifest, bytes } = bakeFarProxy(farGrid(repo, slug), look), dir = join(repo, 'public/assets/baked', slug);
    writeFileSync(join(dir, 'far.glb'), bytes); writeFileSync(join(dir, 'far.json'), canonicalJson(manifest)); out[slug] = manifest;
  }
  return out;
}
