// oxlint-disable-next-line import/no-nodejs-modules -- Node harnesses admit the real immutable terrain corpus before querying it.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the native bytes against their retained output stamp.
import { createHash } from 'node:crypto';
import { parseBakedTerrain } from '@wildshard/format/bakedTerrainBytes';
import { bakedTerrainSource, installDeclaredBakedTerrain } from '@wildshard/engine/world/bakedTerrainField';
import type { ShardManifest } from '@wildshard/game/shard/manifest';

/** Explicit boot admission for renderer-free harnesses; analytic manifests remain untouched. */
export function prepareBakedManifestGround(manifest: Pick<ShardManifest, 'ground'>): void {
  const field = manifest.ground.terrain;
  if (field === undefined) return;
  const source = bakedTerrainSource(field);
  if (source === null) return;
  const path = `public${source.url}`, bytes = Uint8Array.from(readFileSync(path));
  const stamp: unknown = JSON.parse(readFileSync(path.replace(/\.bin$/u, '.json'), 'utf8'));
  if (typeof stamp !== 'object' || stamp === null || !('hash' in stamp)
    || stamp.hash !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Required terrain corpus hash differs');
  const grid = parseBakedTerrain(bytes.buffer);
  if (grid === null) throw new Error('Required terrain corpus is malformed');
  installDeclaredBakedTerrain(field, grid);
}
