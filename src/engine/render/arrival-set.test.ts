import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SkinnedMesh, Vector3 } from 'three';
import { arrivalSet } from './precompile';

test('an arrival keeps page content, its nearby or unbounded drawables, and leaves far ones and hidden subtrees (D188)', () => {
  const page = new Group(), root = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const at = (x: number, parent = root): Mesh => { const mesh = new Mesh(geometry, material); mesh.position.x = x; parent.add(mesh); return mesh; };
  const pageFar = at(900, page), near = at(100), far = at(300), edge = at(125.4);
  const unbounded = at(800); unbounded.frustumCulled = false;
  const skinned = new SkinnedMesh(geometry, material); skinned.position.x = 800; root.add(skinned);
  const hidden = new Group(); hidden.visible = false; root.add(hidden); const underHidden = at(0, hidden);
  root.visible = false; // a parked destination is hidden while it waits; its own flag does not count
  page.updateMatrixWorld(true); root.updateMatrixWorld(true);
  const keep = arrivalSet(root, new Vector3(0, 0, 0), 125);
  expect([keep(pageFar), keep(near), keep(far), keep(edge), keep(unbounded), keep(skinned), keep(underHidden)])
    .toEqual([true, true, false, true, true, true, false]);
  geometry.dispose(); material.dispose();
});
