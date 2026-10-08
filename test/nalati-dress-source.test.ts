import { BufferGeometry, Euler, Float32BufferAttribute, Frustum, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { captureDressLayerSource, DressLayer, type Inst } from '../src/shards/nalati-grasslands/world/dressing/layer';

describe('Nalati immutable dressing source', () => {
  it('copies exact ordered transforms, tints and effective visibility data even with zero initially drawn instances', () => {
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 2, 0], 3)), material = new MeshStandardMaterial();
    const instances: Inst[] = [
      { x: 18, y: 2, z: 0, yaw: 0.5, sx: 2, sy: 3, sz: 4, tiltX: 0.2, tiltZ: -0.1, far: 10, r: 0.2, g: 0.3, b: 0.4 },
      { x: 100, y: 0, z: 4, yaw: -0.7, sx: 0.3, sy: 0.5, sz: 0.2, far: 10, r: 0.7, g: 0.8, b: 0.9 },
    ];
    const layer = new DressLayer('source', geometry, material, instances, { farScale: 2, keepNear: 0 });
    try {
      expect(layer.mesh.count).toBe(0);
      const captured = captureDressLayerSource(layer.mesh); if (captured === undefined) throw new Error('Missing actual layer source');
      const expected = Float32Array.from(instances.flatMap(instance => new Matrix4().compose(new Vector3(instance.x, instance.y, instance.z),
        new Quaternion().setFromEuler(new Euler(instance.tiltX ?? 0, instance.yaw, instance.tiltZ ?? 0, 'YXZ')), new Vector3(instance.sx, instance.sy, instance.sz)).elements));
      expect(captured).toMatchObject({ version: 1, count: 2, ranges: Float32Array.of(20, 20), cellSize: 24, keepNear: 0, fadeStart: 0.82, rangeScale: 2 });
      expect(captured.matrices).toEqual(expected);
      expect(captured.colours).toEqual(Float32Array.of(0.2, 0.3, 0.4, 0.7, 0.8, 0.9));
      expect(captured.spheres.slice(0, 3)).toEqual(Float32Array.of(18, 2, 0));
      layer.cull(new Frustum(), new Vector3());
      expect(layer.mesh.count).toBe(1); // The other copy is out of range, and this one is in the shrink-fade band.
      expect(layer.mesh.instanceMatrix.array[0]).not.toBe(captured.matrices[0]);
      expect(layer.captureSource()).toEqual(captured);
      const original = instances[0]; if (original === undefined) throw new Error('Missing input instance');
      original.x = 900; original.r = 0;
      captured.matrices.fill(99); captured.colours.fill(0); captured.spheres.fill(0); captured.ranges.fill(1);
      layer.mesh.instanceMatrix.array.fill(0); layer.mesh.instanceColor?.array.fill(0);
      const next = layer.captureSource(); expect(next.matrices).toEqual(expected);
      expect(next.colours).toEqual(Float32Array.of(0.2, 0.3, 0.4, 0.7, 0.8, 0.9));
      expect(next.ranges).toEqual(Float32Array.of(20, 20)); expect(next.spheres[0]).toBe(18);
      geometry.dispose(); expect(layer.captureSource()).toEqual(next);
    } finally { geometry.dispose(); material.dispose(); }
  });

  it('does not infer a source from an unrelated mesh, name or visible instance buffer', () => {
    const geometry = new BufferGeometry(), material = new MeshStandardMaterial(), mesh = new Mesh(geometry, material);
    mesh.name = 'nalati-dress-boulder';
    try { expect(captureDressLayerSource(mesh)).toBeUndefined(); }
    finally { geometry.dispose(); material.dispose(); }
  });
});
