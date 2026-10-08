import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { NalatiCaptureInventory } from '../scripts/bake/nalatiCaptureInventory';
import { DressLayer } from '../src/shards/nalati-grasslands/world/dressing/layer';

describe('Nalati authored capture inventory', () => {
  it('copies actual scatter source poses even when registry callbacks have only XYZ and the drawer has zero visible copies', async () => {
    const collector = new NalatiCaptureInventory(), geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const material = new MeshStandardMaterial(), layer = new DressLayer('boulder', geometry, material,
      [{ x: 20, y: 3, z: 4, yaw: 0.5, sx: 2, sy: 3, sz: 4, tiltX: 0.1, far: 100, r: 0.2, g: 0.3, b: 0.4 }], { farScale: 0.6 });
    collector.visitPlacement({ model: 'nalati-grasslands/boulder', placements: [{ x: 20, y: 3, z: 4 }], draw: 'instanced', moving: false, drawnInto: layer.mesh });
    try {
      const result = await collector.snapshot(() => Promise.resolve()), mesh = result.roots[0]?.meshes[0];
      if (mesh?.scatter === undefined || mesh.scatter === null) throw new Error('Missing original scatter source');
      expect(mesh.instances?.count).toBe(0); expect(mesh.scatter.count).toBe(1);
      expect(mesh.scatter).toEqual(layer.captureSource());
      expect(mesh.scatter.matrices[0]).not.toBe(result.placements[0]?.copies[0]?.matrix[0]);
      expect(mesh.scatter.ranges).toEqual(Float32Array.of(60));
      mesh.scatter.matrices.fill(99); mesh.scatter.colours.fill(0);
      expect(layer.captureSource().matrices[0]).not.toBe(99); expect(layer.captureSource().colours[0]).toBeCloseTo(0.2);
    } finally { geometry.dispose(); material.dispose(); }
  });

  it('identifies one physical mesh reached through overlapping static and hybrid roots', async () => {
    const collector = new NalatiCaptureInventory(), outer = new Group(), inner = new Group();
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)), material = new MeshStandardMaterial();
    inner.add(new Mesh(geometry, material)); outer.add(inner);
    collector.visitPlacement({ model: 'nalati-grasslands/kokpar-goal', placements: [], draw: 'merged', moving: false, drawnInto: inner });
    collector.visitPlacement({ model: 'nalati-grasslands/kokpar-rider', placements: [], draw: 'instanced', moving: false, drawnInto: outer });
    try {
      const captured = await collector.snapshot(() => Promise.resolve()), first = captured.roots[0]?.meshes[0], second = captured.roots[1]?.meshes[0];
      if (first === undefined || second === undefined) throw new Error('Missing overlapping mesh');
      expect(first.sourceMesh).toBe(second.sourceMesh); expect(first.matrix).toEqual(second.matrix);
      expect(captured.roots.map(row => row.roles)).toEqual([['static-candidate'], ['hybrid']]);
    } finally { geometry.dispose(); material.dispose(); }
  });

  it('snapshots shared drawnInto roots after the actual GLB promise, retaining invisible copies and mixed ownership', async () => {
    const collector = new NalatiCaptureInventory(), root = new Group(); root.name = 'actual-poi'; root.position.x = 7;
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const material = new MeshStandardMaterial(); material.name = 'authored.felt';
    const matrix = new Matrix4().makeTranslation(20, 3, 0);
    const ordered = [{ x: 20, y: 3, z: 0, matrix }, { x: -15, y: 2, z: 4 }];
    collector.visitPlacement({ model: 'nalati-grasslands/yurt', placements: ordered, draw: 'merged', moving: false, drawnInto: root });
    collector.visitPlacement({ model: 'nalati-grasslands/balbal', placements: [{ x: 0, y: 0, z: 0 }], draw: 'instanced', moving: false, drawnInto: root });
    try {
      let settled = false;
      const result = await collector.snapshot(async () => {
        await Promise.resolve(); const actual = new Mesh(geometry, material); actual.visible = false; root.add(actual); settled = true;
      });
      expect(settled).toBe(true); expect(result.roots).toHaveLength(1); expect(result.roots[0]?.meshes).toHaveLength(1);
      expect(result.roots[0]?.roles).toEqual(['hybrid', 'static-candidate']);
      expect(result.roots[0]?.meshes[0]).toMatchObject({ visible: false, materials: [{ name: 'authored.felt', type: 'MeshStandardMaterial' }] });
      expect(result.roots[0]?.meshes[0]?.matrix[12]).toBe(7);
      expect(result.placements[0]?.copies.map(copy => copy.x)).toEqual([20, -15]);
      geometry.getAttribute('position').setX(0, 999); matrix.setPosition(999, 0, 0); material.name = 'disposed-host';
      expect(result.roots[0]?.meshes[0]?.attributes['position']?.values[0]).toBe(0);
      expect(result.placements[0]?.copies[0]?.matrix[12]).toBe(20);
      expect(() => collector.visitPlacement({ model: 'late', placements: [], draw: 'single', moving: false })).toThrow('sealed');
    } finally { geometry.dispose(); material.dispose(); }
  });

  it('copies actual builder output before the renderer mutates it and never calls another build', async () => {
    const collector = new NalatiCaptureInventory(), geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([1, 2, 3, 2, 2, 3, 1, 3, 3], 3));
    const material = new MeshStandardMaterial(), placements = [{ x: 8, y: 0, z: 2 }];
    const observe = collector.visitPlacement({ model: 'nalati-grasslands/fieldstone', placements, draw: 'merged', moving: false });
    if (observe === undefined) throw new Error('Missing build observer');
    try {
      observe({ kind: 'model', level: 0, params: {}, placements, built: [{ geometry, material }] });
      geometry.translate(100, 0, 0);
      const result = await collector.snapshot(() => Promise.resolve());
      expect(result.builds).toHaveLength(1); expect(result.builds[0]?.meshes[0]?.attributes['position']?.values[0]).toBe(1);
      expect(result.placements[0]?.role).toBe('static-candidate'); expect(result.roots).toHaveLength(0);
    } finally { geometry.dispose(); material.dispose(); }
  });

  it('waits for asynchronous builder groups and keeps their authored own-space transform after placement', async () => {
    const collector = new NalatiCaptureInventory(), built = new Group(); built.position.x = 3;
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([1, 2, 3, 2, 2, 3, 1, 3, 3], 3));
    const material = new MeshStandardMaterial(), placements = [{ x: 80, y: 0, z: 2, yaw: 0.5, scale: 2, color: 0x336699 }];
    const observe = collector.visitPlacement({ model: 'nalati-grasslands/camp-prop', placements, draw: 'single', moving: false });
    if (observe === undefined) throw new Error('Missing build observer');
    try {
      observe({ kind: 'model', level: 0, params: {}, placements, built });
      built.position.set(80, 0, 2);
      const result = await collector.snapshot(async () => { await Promise.resolve(); built.add(new Mesh(geometry, material)); });
      expect(result.builds[0]?.meshes).toHaveLength(1);
      expect(result.builds[0]?.meshes[0]?.matrix[12]).toBe(3);
      expect(result.placements[0]?.copies[0]?.matrix[12]).toBe(80);
      expect(result.placements[0]?.copies[0]?.colour).toBe(0x336699);
    } finally { geometry.dispose(); material.dispose(); }
  });
});
