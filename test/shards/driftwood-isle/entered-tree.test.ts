import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Scene } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { app } from '../../../src/engine/app/runtime';
import { ownSceneTree, sceneObjectOwner } from '../../../src/engine/app/sceneOwnership';
import { ownEnteredTree } from '../../../src/shards/driftwood-isle/quest/Spine';

// SF57: the boot smoke's Developer grid home died with "Scene subtree requires one live owner": a grid region's view
// already owns a registered piece's object, so the entry's own claim on it must stand aside.
it('owns an entry-built subtree once, and leaves a subtree a grid view already owns to that owner', () => {
  const page = new Scope('entered.page'), entry = page.child('runtime.play'), view = page.child('grid.view');
  const scene = new Scene(), root = new Group();
  scene.add(root); ownSceneTree(root, view, app.assets);

  // the borrowed home's case: a plain subtree on the scene becomes the entry's
  const plain = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  scene.add(plain);
  ownEnteredTree(plain, entry);
  expect(sceneObjectOwner(plain)).toBe(entry);

  // the grid region's case: the view gave the piece's object its own scope first; the entry leaves it alone
  const piece = view.child('grid.object:zipline'), placed = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  root.add(placed); ownSceneTree(placed, piece, app.assets);
  expect(() => { ownEnteredTree(placed, entry); }).not.toThrow();
  expect(sceneObjectOwner(placed)).toBe(piece);

  // a subtree only inside the view's root (not its own) is still the entry's
  const inside = new Group();
  root.add(inside);
  ownEnteredTree(inside, entry);
  expect(sceneObjectOwner(inside)).toBe(entry);

  entry.dispose();
  expect(plain.parent).toBeNull(); expect(inside.parent).toBeNull(); expect(placed.parent).toBe(root);
  page.dispose();
});
