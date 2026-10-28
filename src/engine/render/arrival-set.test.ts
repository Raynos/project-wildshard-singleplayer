import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SkinnedMesh, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { arrivalPrograms, arrivalSet } from './precompile';

test('an arrival keeps page content, its nearby, unbounded or hidden drawables, and leaves far shown ones (D188)', () => {
  const page = new Group(), root = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const at = (x: number, parent = root): Mesh => { const mesh = new Mesh(geometry, material); mesh.position.x = x; parent.add(mesh); return mesh; };
  const pageFar = at(900, page), near = at(100), far = at(300), edge = at(125.4);
  const unbounded = at(800); unbounded.frustumCulled = false;
  const skinned = new SkinnedMesh(geometry, material); skinned.position.x = 800; root.add(skinned);
  const hidden = new Group(); hidden.visible = false; root.add(hidden); const underHidden = at(800, hidden);
  root.visible = false; // a parked destination is hidden while it waits; its own flag does not count
  page.updateMatrixWorld(true); root.updateMatrixWorld(true);
  const keep = arrivalSet(root, new Vector3(0, 0, 0), 125);
  expect([keep(pageFar), keep(near), keep(far), keep(edge), keep(unbounded), keep(skinned), keep(underHidden)])
    .toEqual([true, true, false, true, true, true, true]);
  geometry.dispose(); material.dispose();
});

// T10 (G808): a far node-material drawable links before the reveal (its first build is one unsliceable job that landed
// whole in a moving drive frame after it); a far classic one still waits for the after-reveal warm
test('an arrival links every node material before its reveal, wherever it is', () => {
  const root = new Group(), geometry = new BoxGeometry(), classic = new MeshBasicMaterial(), node = new MeshStandardNodeMaterial();
  const at = (x: number, material: MeshBasicMaterial | MeshStandardNodeMaterial): Mesh => {
    const mesh = new Mesh(geometry, material); mesh.position.x = x; root.add(mesh); return mesh; };
  const farClassic = at(300, classic), farNode = at(300, node), nearClassic = at(10, classic);
  root.visible = false; root.updateMatrixWorld(true);
  const programs = arrivalPrograms(root, new Vector3(0, 0, 0), 125);
  expect([programs(farClassic), programs(farNode), programs(nearClassic)]).toEqual([false, true, true]);
  geometry.dispose(); classic.dispose(); node.dispose();
});
