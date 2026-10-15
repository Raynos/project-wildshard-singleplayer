// oxlint-disable-next-line import/no-nodejs-modules -- Actual admitted inert image bytes exercise the reader.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseStillImage } from '../src/format/stillImage';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseMapImage } from '../src/game/shardfile/mapImage';

test('map admission hands off to only the retained bitmap or canvas pixels', () => {
  const bytes = Uint8Array.from(readFileSync('test/fixtures/world-source/image.png'));
  const image = parseStillImage(bytes), hash = 'a'.repeat(64);
  const source = emptyShardfile({ slug: 'map-fixture', name: 'Map', author: 'Test', seed: 1, revision: 1 });
  source.map = { image: hash, tilesHash: hash };
  source.files.push({ hash, kind: 'image', compressed: bytes.length, decoded: image.decoded, gpu: image.gpu,
    triangles: 0, draws: 0, dependencies: [], critical: false });
  for (const retained of [{ width: image.width, height: image.height }, { width: 400, height: 400 }, null]) {
    const scope = new Scope('map'), allocator = new ResidencyAllocator();
    const lease = leaseMapImage(source, new Map([[hash, bytes]]), allocator, scope);
    if (lease === undefined) throw new Error('Map missing');
    expect(allocator.cost().input.libraries).toBe(image.decoded + image.gpu);
    lease.retained(retained);
    expect(allocator.cost().input.libraries).toBe(retained === null ? 0 : retained.width * retained.height * 4);
    expect(() => lease.retained(retained)).toThrow('already settled');
    scope.dispose();
    expect(allocator.entries()).toHaveLength(0);
  }
});
