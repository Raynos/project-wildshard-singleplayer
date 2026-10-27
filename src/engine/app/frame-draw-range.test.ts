import { expect, test } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SkinnedMesh, Sphere, Vector3 } from 'three';
import { Scope } from './scope';
import { FrameDrawRanges } from '../render/frameDrawRange';

function fixture() {
  const scope = new Scope('draw-range'), masks = new FrameDrawRanges(), root = new Scene(), camera = new PerspectiveCamera();
  const geometry = new BoxGeometry(); geometry.computeBoundingSphere();
  const material = new MeshBasicMaterial();
  const mesh = (x: number) => { const value = new Mesh(geometry, material); value.position.x = x; root.add(value); return value; };
  return { scope, masks, root, camera, geometry, material, mesh, dispose: () => { scope.dispose(); geometry.dispose(); material.dispose(); } };
}

test('ordinary frame ranges preserve nearby road, screen/sky and originally hidden nodes', () => {
  const f = fixture(), near = f.mesh(0), far = f.mesh(500), sky = f.mesh(500), hidden = f.mesh(500);
  sky.frustumCulled = false; hidden.visible = false;
  const range = f.masks.bind(f.scope, 125); range.enabled = true;
  try {
    f.masks.draw(f.root, f.camera, { render: dt => {
      expect(dt).toBe(.03); expect(near.visible).toBe(true); expect(sky.visible).toBe(true);
      expect(far.visible).toBe(false); expect(hidden.visible).toBe(false);
    } }, .03);
    expect(far.visible).toBe(true); expect(hidden.visible).toBe(false);
  } finally { f.dispose(); }
});

test('transformed bounds and instance aggregate bounds keep an overlapping neighbourhood', () => {
  const f = fixture(), overlap = f.mesh(140), nearInstances = new InstancedMesh(f.geometry, f.material, 1), farInstances = new InstancedMesh(f.geometry, f.material, 1);
  const larger = f.geometry.clone(); larger.boundingSphere = new Sphere(new Vector3(), 50); overlap.geometry = larger;
  nearInstances.position.x = 500; nearInstances.boundingSphere = new Sphere(new Vector3(-500, 0, 0), 1);
  farInstances.boundingSphere = new Sphere(new Vector3(500, 0, 0), 1);
  f.root.add(nearInstances, farInstances); f.masks.bind(f.scope, 125).enabled = true;
  try { f.masks.draw(f.root, f.camera, { render: () => {
    expect(overlap.visible).toBe(true); expect(nearInstances.visible).toBe(true); expect(farInstances.visible).toBe(false);
  } }, .03); } finally { larger.dispose(); f.dispose(); }
});

test('unknown bounds, skinned/custom objects and meshes containing children keep their normal draw', () => {
  const f = fixture(), unknown = f.mesh(500), custom = f.mesh(500), shadow = f.mesh(500), parent = f.mesh(500);
  const missing = new BoxGeometry(); unknown.geometry = missing;
  custom.onBeforeRender = () => undefined; shadow.onBeforeShadow = () => undefined; parent.add(new Group());
  const skin = new SkinnedMesh(f.geometry, f.material); skin.position.x = 500; f.root.add(skin);
  f.masks.bind(f.scope, 125).enabled = true;
  try { f.masks.draw(f.root, f.camera, { render: () => {
    expect([unknown.visible, custom.visible, shadow.visible, parent.visible, skin.visible]).toEqual([true, true, true, true, true]);
  } }, .03); } finally { missing.dispose(); f.dispose(); }
});

test('failed draw restores flags before another preparation or ordinary draw', () => {
  const f = fixture(), far = f.mesh(500), failure = new Error('draw failed'), range = f.masks.bind(f.scope, 125); range.enabled = true;
  try {
    expect(() => f.masks.draw(f.root, f.camera, { render: () => { expect(far.visible).toBe(false); throw failure; } }, .03)).toThrow(failure);
    expect(far.visible).toBe(true);
    range.enabled = false;
    f.masks.draw(f.root, f.camera, { render: () => { expect(far.visible).toBe(true); } }, .03);
  } finally { f.dispose(); }
});

test('retired ranges release their masks even if their old signal remains enabled', () => {
  const f = fixture(), far = f.mesh(500), owner = f.scope.child('range'), range = f.masks.bind(owner, 125); range.enabled = true;
  owner.dispose();
  try { f.masks.draw(f.root, f.camera, { render: () => { expect(far.visible).toBe(true); } }, .03);
    expect(() => f.masks.bind(owner, 125)).toThrow('live owner');
    expect(() => f.masks.bind(f.scope, Infinity)).toThrow('positive distance');
  } finally { f.dispose(); }
});

test('sliced retirement stops masking before its disposal handlers finish', () => {
  const f = fixture(), far = f.mesh(500), owner = f.scope.child('retiring-range');
  f.masks.bind(owner, 125).enabled = true; owner.onDispose(() => undefined);
  const steps = owner.disposeSteps(); steps.next(); expect(owner.disposing).toBe(true);
  try { f.masks.draw(f.root, f.camera, { render: () => { expect(far.visible).toBe(true); } }, .03); }
  finally { for (const _step of steps) { /* drain */ } f.dispose(); }
});
