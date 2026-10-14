import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { bindWorldSceneParts, createWorldScene } from '../src/game/plugin/ui';
import { SKY_VANES } from '../src/shards/far-reach/data/routeScene.generated';

it('keeps each vane rotor independently movable at its declared interaction anchor', () => {
  const geometry = new BoxGeometry(), made = createWorldScene(SKY_VANES.recipe, {
    geometry: () => geometry, model: () => null, baked: () => ({ root: new Group(), colliders: [] }),
  });
  const parts = bindWorldSceneParts(made, SKY_VANES.kinds, SKY_VANES.ports);
  for (const row of SKY_VANES.rows) {
    const rotor = parts[row.rotor], anchor = parts[row.at], before = new Vector3();
    rotor.getWorldPosition(before);
    expect(anchor.y).toBeGreaterThan(before.y);
    expect(anchor.x).toBe(before.x); expect(anchor.z).toBe(before.z);
    rotor.rotation.y = 0.7;
    expect(rotor.children.some(child => child instanceof Mesh)).toBe(true);
    expect(rotor.parent?.rotation.y).toBe(0);
  }
  expect(new Set(SKY_VANES.bindings.map(row => row.piece)).size).toBe(SKY_VANES.rows.length);
  made.dispose(); geometry.dispose();
});

it('keeps native rotor ports available without drawing missing model parts', () => {
  const made = createWorldScene(SKY_VANES.recipe, {
    geometry: () => null, model: () => null, baked: () => ({ root: new Group(), colliders: [] }),
  });
  const parts = bindWorldSceneParts(made, SKY_VANES.kinds, SKY_VANES.ports);
  let drawn = false; made.root.traverse(object => { if (object instanceof Mesh) drawn = true; });
  expect(drawn).toBe(false);
  for (const row of SKY_VANES.rows) { parts[row.rotor].rotation.y = 1; expect(parts[row.rotor].parent).not.toBeNull(); }
  made.dispose();
});
