import { expect, it } from 'vitest';
import { BufferGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { crownInstances } from '../src/shards/far-reach/generators/crownInstances';
import { CROWN_STONES } from '../src/shards/far-reach/data/crownLayout';
import { CROWN } from '../src/shards/far-reach/data/layout';
import { CARVED } from '../src/shards/far-reach/data/modelFrames';
import rows from '../src/shards/far-reach/data/crownInstances.generated.json' with { type: 'json' };

it('retains every original crown instance word and alternating model order', () => {
  const baked = crownInstances();
  expect(baked).toEqual(rows);
  for (const [model, actual] of baked.entries()) {
    const stones = CROWN_STONES.filter((_, index) => index % 2 === model);
    const original = new InstancedMesh(new BufferGeometry(), undefined, stones.length);
    const matrix = new Matrix4(), rotation = new Quaternion(), up = new Vector3(0, 1, 0);
    stones.forEach((stone, index) => {
      rotation.setFromAxisAngle(up, stone.yaw + CARVED.yaw);
      matrix.compose(new Vector3(stone.x, CROWN.y - CARVED.sink, stone.z), rotation, new Vector3(stone.h, stone.h, stone.h));
      original.setMatrixAt(index, matrix);
    });
    expect(Float32Array.from(actual)).toEqual(original.instanceMatrix.array);
    expect(actual).toHaveLength(stones.length * 16);
    original.geometry.dispose(); original.dispose();
  }
});
