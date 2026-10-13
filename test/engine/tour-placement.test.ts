import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Tour } from '../../src/engine/core/Tour';
import { bindHeightfield, HeightfieldBinding } from '../../src/engine/world/Heightfield';
import { terrainFieldFor } from '../../src/engine/world/groundField';
import { createBakedTerrainField } from '../../src/engine/world/bakedTerrainField';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';

it('constructs a neutral shell tour without reading its unadmitted home terrain', () => {
  const required = createBakedTerrainField({ key: 'unadmitted-home', seed: 3 }, TEMPLATE.ground.terrain ?? terrainFieldFor({ structures: true }, 'metadata'));
  const restore = bindHeightfield(new HeightfieldBinding({ ...toLevelSpec(TEMPLATE), ground: { terrain: required } }));
  try {
    expect(() => new Tour(new PerspectiveCamera())).toThrow('not ready');
    const camera = new PerspectiveCamera();
    const shell = terrainFieldFor({ structures: true }, 'platform.grid');
    const tour = new Tour(camera, shell.heightAt);
    tour.setTime(0);
    expect(camera.position.toArray()).toEqual([0, -998.3, -240]);
    expect(() => required.heightAt(0, 0)).toThrow('not ready');
  } finally { restore(); }
});

it('keeps the terrain-bearing tour identical when its existing sampler is passed explicitly', () => {
  const level = toLevelSpec(TEMPLATE), restore = bindHeightfield(new HeightfieldBinding(level));
  try {
    const left = new PerspectiveCamera(), right = new PerspectiveCamera();
    const implicit = new Tour(left), explicit = new Tour(right, terrainFieldFor(level.ground, level.id).heightAt);
    for (const time of [0, 7, 20, 40]) {
      implicit.setTime(time); explicit.setTime(time);
      expect(right.position.toArray()).toEqual(left.position.toArray());
      expect(right.quaternion.toArray()).toEqual(left.quaternion.toArray());
    }
  } finally { restore(); }
});
