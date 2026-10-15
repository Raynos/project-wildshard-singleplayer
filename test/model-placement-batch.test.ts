// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { BoxGeometry, Group, Matrix4, MeshStandardMaterial } from 'three';
import { defineModel, modelContext } from '../src/engine/models/model';
import { ModelPlacementBatch, modelPoseMatrix } from '../src/engine/models/placementBatch';
import { WorldRegistry, type ColliderDesc } from '../src/engine/world/registry';

test('heterogeneous ordered placements retain params, frames, colliders, floors and unregistered parents', async () => {
  const material = new MeshStandardMaterial(), order: string[] = [], root = new Group(), colliders: ColliderDesc[] = [];
  const first = defineModel({ id: 'shared/batch-first-fixture', name: 'First', file: 'test/model-placement-batch.test.ts', category: 'props', pipeline: 'code', defaults: { width: 2 },
    build: (_ctx, p) => { order.push('first'); return [{ geometry: new BoxGeometry(p.width, 1, 1), material }]; },
    colliders: p => [{ kind: 'box', x: 0, y: 0, z: 0, hx: p.width / 2, hy: 0.5, hz: 0.5 }] });
  const second = defineModel({ id: 'shared/batch-second-fixture', name: 'Second', file: 'test/model-placement-batch.test.ts', category: 'props', pipeline: 'code', defaults: { enabled: true },
    build: (_ctx, p) => { order.push(p.enabled ? 'second' : 'disabled'); return [{ geometry: new BoxGeometry(), material }]; } });
  const context = modelContext(null), batch = new ModelPlacementBatch({ ctx: context, registry: null, fallbackParent: root, colliders });
  const frame = new Matrix4().makeRotationY(0.7).setPosition(10, 4, -8), before = frame.clone();
  const a = await batch.frames(first, [frame], { width: 4 }, { draw: 'single' });
  const pose = { x: -3, y: 2, z: 5, yaw: 0.2, scale: 2, pitch: 0.1, roll: -0.1 };
  const b = await batch.poses(second, [pose], 0.4, { params: { enabled: false } }, { draw: 'single' });
  expect(order).toEqual(['first', 'disabled']);
  expect(root.children).toEqual([a.object, b?.placed.object]);
  expect(colliders).toEqual(a.colliders);
  expect(frame.equals(before)).toBe(true);
  expect(pose.yaw).toBe(0.2);
  expect(b?.places[0]?.yaw).toBeCloseTo(0.6);
  expect(modelPoseMatrix(pose).elements.slice(12, 15)).toEqual([-3, 2, 5]);
  expect(await batch.poses(second, [], 0, {}, { draw: 'single' })).toBeNull();
  expect(order).toHaveLength(2);
  const registry = new WorldRegistry(), registered = new ModelPlacementBatch({ ctx: context, registry, fallbackParent: root });
  await registered.frames(first, [frame], undefined, { draw: 'single', piece: { id: 'ordered-floor', floor: () => 4, solidFloor: true } });
  expect(root.children).toHaveLength(2);
  expect(registry.floorAt(10, -8)).toBe(4);
  material.dispose();
});
