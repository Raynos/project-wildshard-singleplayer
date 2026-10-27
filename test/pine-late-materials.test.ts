import { expect, test } from 'vitest';
import { nameBlob } from '../src/sdk/blobs';
import { pineLateMaterialFiles } from '../src/shards/pine-hollow/generators/lateMaterials';

const pose = (x: number, z: number) => ({ x, y: 0, z, yaw: 0, pitch: 0, roll: 0, scale: 1 });
const landmarks = {
  stones: [{ kind: 'stone-a', places: [pose(200, 200), pose(10, -200)] }, { kind: 'stone-b', places: [pose(20, -190)] }, { kind: 'stone-c', places: [pose(-20, -180)] }],
  waystones: [pose(40, -50)], dam: [pose(20, 30)], canoe: [pose(10, 40)], board: [pose(-30, 50)], arch: pose(20, 100),
};

test('Pine schedules fine and cabin materials with original nearby coarse families retained', () => {
  const marks = ['stone-a', 'stone-b', 'stone-c', 'waystone', 'beaver-dam', 'canoe', 'contract-board', 'cave-arch'];
  const variants = [...marks.flatMap(id => [`pine-hollow-hero/${id}`, `pine-hollow-hero/${id}-lod1`]), 'hatchet', 'wine_barrel_01', 'wooden_bucket_01', 'wooden_crate_02', 'people/ranger', 'people/miller', 'people/trader'];
  const blobs = variants.map((variantOf, i) => nameBlob(`maps/${String(i)}.bin`, 'bin', new Uint8Array([i]), { variantOf }));
  const files = blobs.map(row => row.file), before = structuredClone(blobs), hints = pineLateMaterialFiles(files, landmarks);
  expect(hints).toHaveLength(15);
  for (const [i, variant] of variants.entries()) expect(hints.some(row => row.hash === files[i]?.hash)).toBe(!variant.endsWith('-lod1'));
  expect(hints.find(row => row.hash === files[0]?.hash)?.at).toEqual([10, -200]);
  expect(hints.find(row => row.hash === files[19]?.hash)?.at).toEqual([-150, -138]);
  expect(blobs).toEqual(before);
});
