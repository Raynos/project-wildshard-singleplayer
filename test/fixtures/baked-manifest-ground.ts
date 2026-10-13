// oxlint-disable-next-line import/no-nodejs-modules -- Node harnesses admit the real committed terrain collider before querying it.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the collider bytes against their content address.
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/format/terrainTileBytes';
import { bakedTerrainSource, installDeclaredBakedTerrain, type RequiredGround } from '@wildshard/engine/world/bakedTerrainField';
import type { ShardManifest } from '@wildshard/game/shard/manifest';

const TerrainSection = v.object({ terrain: v.object({ collider: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)) }) });

/** The shard's own committed terrain collider (`src/shards/<key>/data/tiles.json` → `assets/<sha256>`), read as the client ground reads it. */
export function committedColliderGround(key: string, seed: number): RequiredGround {
  const { terrain } = v.parse(TerrainSection, JSON.parse(readFileSync(`src/shards/${key}/data/tiles.json`, 'utf8')));
  const bytes = Uint8Array.from(readFileSync(`src/shards/${key}/assets/${terrain.collider}`));
  if (createHash('sha256').update(bytes).digest('hex') !== terrain.collider) throw new Error('Required terrain collider hash differs');
  const data = decodeTerrainTile(bytes);
  const heightAt = (x: number, z: number): number => (x < -250 || x > 250 || z < -250 || z > 250 ? 0 : terrainTileHeight(data, x, z));
  return { seed, heightAt, normalAt: (x, z, eps = 0.25) => {
    const dx = heightAt(x - eps, z) - heightAt(x + eps, z), dz = heightAt(x, z - eps) - heightAt(x, z + eps), length = Math.hypot(dx, 2 * eps, dz);
    return [dx / length, 2 * eps / length, dz / length];
  }, splatAt: () => [1, 0, 0, 0] };
}

/** Explicit boot admission for renderer-free harnesses; analytic manifests remain untouched. */
export function prepareBakedManifestGround(manifest: Pick<ShardManifest, 'ground'>): void {
  const field = manifest.ground.terrain;
  if (field === undefined) return;
  const source = bakedTerrainSource(field);
  if (source === null) return;
  installDeclaredBakedTerrain(field, committedColliderGround(source.key, source.seed));
}
