import { expect, test } from 'vitest';
import { bootPackParts } from '../scripts/boot-pack-parts.mjs';

test('texture cohorts isolate revisions, unrelated families and non-texture files', () => {
  const paths = [
    '/assets/sky.jpg',
    '/assets/gpu/rock/diffuse-00000000.ktx2', '/assets/gpu/rock/normal-11111111.ktx2', '/assets/gpu/rock/arm-22222222.ktx2',
    '/assets/gpu/rock/diffuse-33333333.ktx2', '/assets/gpu/rock/normal-44444444.ktx2', '/assets/gpu/rock/arm-55555555.ktx2',
    '/assets/gpu/tree/cards-66666666.ktx2', '/assets/gpu/tree/normal-77777777.ktx2',
    '/assets/model.glb', '/assets/props.bin',
  ];
  const groups = bootPackParts(paths, () => 100);
  expect(groups).toEqual([paths.slice(0, 1), paths.slice(1, 4), paths.slice(4, 7), paths.slice(7, 9), paths.slice(9)]);
  expect(groups.flat()).toEqual(paths);
  expect(bootPackParts([], () => 100)).toEqual([]);
});

test('texture parts split before the original demand-reader cap, never through a file', () => {
  const paths = ['a', 'b', 'c', 'd'].map(slot => `/assets/gpu/coats/${slot}-00000000.ktx2`);
  const sizes = [2_097_152, 2_097_152, 4_194_305, 10];
  const sizeOf = (path: string): number => {
    const size = sizes[paths.indexOf(path)];
    if (size === undefined) throw new Error('Unknown part fixture');
    return size;
  };
  expect(bootPackParts(paths, sizeOf)).toEqual([paths.slice(0, 2), paths.slice(2, 3), paths.slice(3)]);
});

test('non-texture parts retain boot order and image-before-glTF adjacency', () => {
  const paths = ['/assets/models/prop/textures/color.png', '/assets/models/prop/textures/normal.png',
    '/assets/models/prop/prop.gltf', '/assets/world.bin'];
  expect(bootPackParts(paths, () => 3_000_000)).toEqual([paths.slice(0, 3), paths.slice(3)]);
});
