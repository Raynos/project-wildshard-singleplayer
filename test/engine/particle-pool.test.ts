import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ParticlePool, pointScale } from '../../src/engine/fx/ParticlePool';

describe('ParticlePool (E357 X5)', () => {
  it('lays out position then the declared attributes, in order, with their usage', () => {
    const material = new THREE.PointsMaterial();
    const pool = new ParticlePool({ capacity: 6, material, renderOrder: 10,
      attributes: { aSize: { itemSize: 1, dynamic: true }, aAlpha: { itemSize: 1, dynamic: true }, aColor: { itemSize: 3, dynamic: false } } });
    const g = pool.points.geometry;
    expect(Object.keys(g.attributes)).toEqual(['position', 'aSize', 'aAlpha', 'aColor']);
    expect(pool.posAttr.usage).toBe(THREE.DynamicDrawUsage);
    expect(pool.attr.aAlpha.usage).toBe(THREE.DynamicDrawUsage);
    expect(pool.attr.aColor.usage).toBe(THREE.StaticDrawUsage);
    expect(pool.data.aColor.length).toBe(18);
    expect(pool.points.frustumCulled).toBe(false);
    expect(pool.points.renderOrder).toBe(10);
    expect(g.boundingSphere?.radius).toBe(1e6);
    expect(pool.points.material).toBe(material);
  });

  it('claims slots round a ring and parks free ones where the spec says', () => {
    const pool = new ParticlePool({ capacity: 3, material: new THREE.PointsMaterial(), renderOrder: 5, attributes: {}, parkY: -1000 });
    expect([pool.claim(), pool.claim(), pool.claim(), pool.claim()]).toEqual([0, 1, 2, 0]);
    expect(Array.from(pool.pos)).toEqual([0, -1000, 0, 0, -1000, 0, 0, -1000, 0]);
    pool.place(1, { x: 1, y: 2, z: 3 });
    expect(Array.from(pool.pos.subarray(3, 6))).toEqual([1, 2, 3]);
  });

  it('sizes points by the drawing buffer height over the vertical field', () => {
    const camera = new THREE.PerspectiveCamera(60);
    const renderer = { getDrawingBufferSize: (out: THREE.Vector2): THREE.Vector2 => out.set(1170, 2532) };
    expect(pointScale(renderer, camera)).toBe(2532 / (2 * Math.tan(THREE.MathUtils.degToRad(60) / 2)));
  });
});
