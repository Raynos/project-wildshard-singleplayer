import { expect, test } from 'vitest';
import { Mesh, PerspectiveCamera, Vector3 } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import type { ReinRibbonFrame, ReinRibbonRows } from '@wildshard/format/riding';
import { ReinRibbon, buildReinsRibbon, fillRein } from '@wildshard/game/riding/reins';
import rows from '../src/shards/nalati-grasslands/data/reins.json' with { type: 'json' };

const orchard: ReinRibbonRows = { span: 3, halfWidth: .014, heldRate: 4, droppedSag: .09,
  hand: { x: .3, y: -1.2, depth: .7 }, neck: { down: .02, out: .13 }, jowl: { down: .08, out: .2 },
  bit: { back: .2, out: .1 }, colour: [.12, .2, .3], edge: [.3, .4, .6], paint: { rim: .2, bands: .4, shade: .9 } };
const frame: ReinRibbonFrame = { yaw: Math.PI, drop: false, withers: [0, -.5, -.7], crest: [0, -.5, -1.05], head: [0, -.55, -1.75], muzzle: [0, -1, -2.1] };

function centre(mesh: Mesh, index: number): Vector3 {
  const positions = mesh.geometry.getAttribute('position');
  return new Vector3().fromBufferAttribute(positions, index).add(new Vector3().fromBufferAttribute(positions, index + 1)).multiplyScalar(.5);
}

test.each([['steppe', rows], ['orchard mule', orchard]] as const)('%s rows draw camera-attached straps, drop and release', (_name, profile) => {
  const scope = new Scope('rein-fixture'), camera = new PerspectiveCamera(70, 9 / 19.5), ribbon = new ReinRibbon(camera, profile, scope);
  const child = ribbon.group.children[0];
  if (!(child instanceof Mesh)) throw new Error('Missing rein mesh');
  const mesh = child as Mesh;
  let geometryDisposed = false, materialDisposed = false;
  mesh.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  material?.addEventListener('dispose', () => { materialDisposed = true; });
  try {
    expect(ribbon.group.visible).toBe(false);
    ribbon.update(1 / 30, frame);
    expect(mesh.geometry.getAttribute('position').count).toBe(4 * (profile.span * 3 + 1));
    const tan = Math.tan(70 * Math.PI / 360), hand = new Vector3(-profile.hand.x * profile.hand.depth * tan * camera.aspect, profile.hand.y * profile.hand.depth * tan, -profile.hand.depth);
    expect(centre(mesh, 0).distanceTo(hand)).toBeLessThan(1e-6);
    const bit = new Vector3(...frame.muzzle).lerp(new Vector3(...frame.head), profile.bit.back).add(new Vector3(-profile.bit.out, 0, 0));
    expect(centre(mesh, profile.span * 6).distanceTo(bit)).toBeLessThan(1e-6);
    ribbon.update(1, { ...frame, drop: true });
    expect(centre(mesh, 0).distanceTo(new Vector3(...frame.withers))).toBeLessThan(1e-6);
    camera.position.set(2, 1, 0); camera.rotation.y = .3;
    ribbon.update(1 / 30, { ...frame, drop: true });
    const expected = new Vector3(...frame.withers).applyMatrix4(camera.matrixWorldInverse);
    expect(centre(mesh, 0).distanceTo(expected)).toBeLessThan(1e-6);
    expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    ribbon.update(0, null);
    expect(ribbon.group.visible).toBe(false);
    ribbon.update(0, frame);
    expect(centre(mesh, 0).distanceTo(hand)).toBeLessThan(1e-6);
  } finally { scope.dispose(); }
  expect(ribbon.group.parent).toBe(null);
  expect(geometryDisposed).toBe(true); expect(materialDisposed).toBe(true);
});

test('the strap follows all three Catmull-Rom spans and keeps its authored width', () => {
  const built = buildReinsRibbon(orchard), points = [new Vector3(-.1, -.6, -.1), new Vector3(-.2, -.7, -.4), new Vector3(-.4, -.4, -1), new Vector3(-.3, -.6, -1.5), new Vector3(-.2, -.8, -2), new Vector3(-.1, -1, -2.5)];
  try {
    fillRein(built.pos, 0, points, orchard);
    for (let span = 0; span < 4; span++) {
      const point = points[span + 1];
      expect(centre(built.mesh, span * orchard.span * 2).distanceTo(point ?? new Vector3())).toBeLessThan(1e-6);
    }
    const left = new Vector3().fromArray(built.pos), right = new Vector3().fromArray(built.pos, 3);
    expect(left.distanceTo(right)).toBeCloseTo(orchard.halfWidth * 2, 6);
  } finally { built.mesh.geometry.dispose(); for (const material of Array.isArray(built.mesh.material) ? built.mesh.material : [built.mesh.material]) material.dispose(); }
  expect(() => buildReinsRibbon({ ...orchard, span: 0 })).toThrow('Invalid rein dimensions');
});
