// oxlint-disable-next-line import/no-nodejs-modules -- Hash the actual pre-pick vertex and collider bytes in this native oracle.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the retired source and row are absent from the clean export.
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { Rng } from '../../../src/engine/core/rng';
import { modelContext } from '../../../src/engine/models/model';
import { pier, pierColliders, type PierParams } from '../../../src/shards/driftwood-isle/models/pier';
import { fakeWorld } from '../../fake/world';

const CASES: readonly PierParams[] = [
  { ...pier.defaults, width: 4, length: 45, landing: { rampFrom: 39.5, landY: -0.8, postGround: [-0.8, -0.8] }, seaRamp: { run: 9, landY: -1.2, flare: 8 } },
  { ...pier.defaults, width: 3, length: 66, seaRamp: { run: 9, landY: -1.2, flare: 8 } },
  { ...pier.defaults, width: 3, length: 51, seaRamp: { run: 9, landY: -1.2, flare: 8 } },
  { ...pier.defaults, width: 3, length: 42, landing: { rampFrom: 36.5, landY: -0.4, postGround: [-0.4, -0.6] }, seaRamp: { run: 9, landY: -1.2, flare: 8 } },
  { ...pier.defaults }, // the flat Model Explorer specimen is not the losing sea-ramp variant
];

function fingerprints(): string[] {
  return CASES.map((params) => {
    const built = pier.build(modelContext(fakeWorld().sky), params, new Rng(pier.seed ?? 0));
    if (built instanceof THREE.Object3D) throw new Error('Pier must retain its real geometry parts');
    const hash = createHash('sha256');
    for (const part of built) {
      hash.update(JSON.stringify([part.castShadow, part.receiveShadow]));
      for (const name of Object.keys(part.geometry.attributes).sort()) {
        const attribute = part.geometry.getAttribute(name);
        if (attribute instanceof THREE.InterleavedBufferAttribute) throw new Error('Unexpected interleaved pier geometry');
        hash.update(JSON.stringify([name, attribute.itemSize, attribute.normalized]));
        hash.update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
      }
      const index = part.geometry.index;
      if (index !== null) hash.update(new Uint8Array(index.array.buffer, index.array.byteOffset, index.array.byteLength));
      part.geometry.dispose();
    }
    hash.update(JSON.stringify(pierColliders(params)));
    return hash.digest('hex');
  });
}

it('preserves every flared deck/cloth vertex, colour, normal, shadow flag and collider byte after Jake’s pick', () => {
  // Captured from the actual pre-retirement builder at e395b2ae69e55a448a05d3561225427a55890a0c.
  // Defining model SHA256: c640caa8eaf81c3f44f6c0f0a78d7d1984dab2847cf77899955a0af1df72a0ef. No replacement geometry oracle.
  expect(fingerprints()).toEqual([
    "a24e225ecb4aea6500401c931a4a0ebd6bce1796419a70f143e4efa1e8287284",
    "da31b8328596dddb4a619e48bbaa55dc8e10a2e8a3730d60cb670dba2ef28f8d",
    "01e5e42498df24ce4c472066c2092c0b09e79ff70bf5e9066b52e0e5af7802d8",
    "f4fc5ffba2a21f8fe235aee66a294780ad505a1dd97cc83073e91156e8ea7786",
    "e40c7a0aea5657658b15f229ff65c95fe2bacf59cdfe315fe23ce30e23a818c1"
]);
});

it('removes the losing reader, row and straight-ramp branches', () => {
  const root = new URL('../../../', import.meta.url);
  const build = readFileSync(new URL('src/shards/driftwood-isle/world/build.ts', root), 'utf8');
  expect(build).not.toContain('pierRampPick');
  expect(existsSync(new URL('src/shards/driftwood-isle/world/pierRamps.ts', root))).toBe(false);
  const runtime = readFileSync(new URL('src/shards/driftwood-isle/runtime/index.ts', root), 'utf8');
  expect(runtime).not.toContain('pierRamps');
  const model = readFileSync(new URL('src/shards/driftwood-isle/models/pier.ts', root), 'utf8');
  expect(model).not.toContain('flare?:');
  expect(model).not.toContain('flare === undefined');
});
