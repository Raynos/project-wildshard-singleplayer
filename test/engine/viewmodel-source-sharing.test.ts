import { expect, it } from 'vitest';
import { ClampToEdgeWrapping, DataTexture, RepeatWrapping, SRGBColorSpace, NoColorSpace } from 'three';
import { ViewmodelSources } from '../../src/engine/player/viewmodelSources';

function fixture() {
  let builds = 0;
  const memo = new ViewmodelSources((source, srgb) => {
    const texture = new DataTexture(); texture.source = source;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    return texture;
  });
  const build = () => {
    builds++;
    const texture = () => { const result = new DataTexture(new Uint8Array([32, 96, 160, 255]), 1, 1);
      result.wrapS = result.wrapT = RepeatWrapping; return result; };
    return { map: texture(), normalMap: texture(), armMap: texture() };
  };
  return { memo, build, builds: () => builds };
}

it('shares source pixels while held, drop and late Explorer samplers remain independent', () => {
  const { memo, build, builds } = fixture();
  const held = memo.take('walnut', true, build);
  held.map.repeat.set(1, 4); held.map.wrapS = ClampToEdgeWrapping;
  const drop = memo.take('walnut', true, build);
  expect(builds()).toBe(1); expect(held.map).not.toBe(drop.map);
  expect(held.map.source).toBe(drop.map.source); expect(held.normalMap.source).toBe(drop.normalMap.source);
  expect(held.armMap?.source).toBe(drop.armMap?.source);
  expect(drop.map.wrapS).toBe(RepeatWrapping); expect(drop.map.repeat.toArray()).toEqual([1, 1]);
  const pixels = held.map.image.data;
  held.map.dispose(); held.normalMap.dispose(); held.armMap?.dispose();
  const explorer = memo.take('walnut', true, build), borrowed = explorer.map.clone();
  borrowed.repeat.set(1.6, 0.9);
  expect(explorer.map.source).toBe(drop.map.source); expect(borrowed.source).toBe(drop.map.source);
  expect(explorer.map.image.data).toBe(pixels); expect(explorer.map.repeat.toArray()).toEqual([1, 1]);
  for (const set of [drop, explorer]) { set.map.dispose(); set.normalMap.dispose(); set.armMap?.dispose(); }
  borrowed.dispose();
});

it('preserves independent sources when sharing is disabled', () => {
  const { memo, build, builds } = fixture();
  const first = memo.take('walnut', false, build), second = memo.take('walnut', false, build);
  expect(builds()).toBe(2); expect(first.map.source).not.toBe(second.map.source);
  expect(first.map.image.data).toEqual(second.map.image.data);
  for (const set of [first, second]) { set.map.dispose(); set.normalMap.dispose(); set.armMap?.dispose(); }
});

it('keeps named sets separate and supports a cord without an ARM plane', () => {
  const { memo, build, builds } = fixture();
  const cordBuild = () => ({ ...build(), armMap: null });
  const cord = memo.take('cord', true, cordBuild), secondCord = memo.take('cord', true, cordBuild);
  const bolt = memo.take('bolt', true, build);
  expect(cord.map.source).toBe(secondCord.map.source); expect(cord.armMap).toBeNull();
  expect(bolt.map.source).not.toBe(cord.map.source); expect(builds()).toBe(2);
  for (const set of [cord, secondCord, bolt]) { set.map.dispose(); set.normalMap.dispose(); set.armMap?.dispose(); }
});
