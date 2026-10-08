// SF67 fix 3 (E461): the code-built worlds' voxel AO is baked at build (scripts/bake-voxel-ao.mjs); bake-check rebuilds the
// tables byte for byte (the stale gate) and `--verify` builds each world as the page does, with every AO call answered.
// This pins the engine side: a recorded table answers the same inputs bit for bit, and any other input marches.
import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Vector3 } from 'three';
import { addVoxelAOBake, encodeVoxelAOBake, hemisphere, recordVoxelAO, voxelAO, voxelAOBakeStats, type VoxelAOParams } from '../src/engine/world/voxelAO';

const params = (geo: BoxGeometry): VoxelAOParams => {
  geo.computeBoundingBox();
  const box = geo.boundingBox ?? new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  return { box, cell: 0.1, pad: 2, spacing: 0.5, maxSamples: 24, indexed: true, ground: { below: -0.4 }, sample: 'vertex', offset: 1.5,
    hemi: hemisphere([[0.9, 3], [0.5, 6], [0.15, 8]], 0.7), steps: 8, stepLen: 0.12, falloff: 0.6, strength: 0.8, downDark: 0.1 };
};
const bits = (k: Float64Array): Uint8Array => new Uint8Array(k.buffer.slice(0));

describe('voxel AO bake (SF67)', () => {
  it('answers a recorded geometry bit for bit and marches any other', () => {
    const a = new BoxGeometry(1, 0.5, 0.8, 3, 2, 3), b = new BoxGeometry(1, 0.5, 0.8, 3, 2, 4);
    const rec = recordVoxelAO();
    const ka = voxelAO(a, params(a));
    rec.stop();
    expect(rec.entries.size).toBe(1);
    const bytes = encodeVoxelAOBake(rec.entries);
    const table = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(table).set(bytes);
    const kb = voxelAO(b, params(b));
    const drop = addVoxelAOBake(table);
    const before = voxelAOBakeStats();
    expect(bits(voxelAO(a, params(a)))).toEqual(bits(ka));
    expect(bits(voxelAO(b, params(b)))).toEqual(bits(kb));
    const after = voxelAOBakeStats();
    expect(after.hits - before.hits).toBe(1);
    expect(after.misses - before.misses).toBe(1);
    // other params (a different strength) are a different key
    expect(bits(voxelAO(a, { ...params(a), strength: 0.5 }))).not.toEqual(bits(ka));
    drop();
    expect(voxelAOBakeStats().entries).toBe(before.entries - 1);
  });

  it('adds nothing from bytes that are not a table', () => {
    const drop = addVoxelAOBake(new ArrayBuffer(64));
    expect(voxelAOBakeStats().entries).toBe(0);
    drop();
  });
});
