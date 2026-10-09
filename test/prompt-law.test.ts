import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { pickInteractable } from '../src/engine/world/interact/Interactables';
import { pickPrompt, promptVisible, setPromptSight } from '../src/engine/world/interact/prompts';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { tagCollider } from '../src/engine/physics/surface';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

it('uses plain rows with strict reach, stable ties, hidden getters and weak fallback', () => {
  const eye = { x: 0, y: 1, z: 0 }, first = { position: { x: 2, y: 1, z: 0 }, radius: 3 };
  const equal = { position: { x: -2, y: 1, z: 0 }, radius: 3 };
  const weak = { position: { x: 0.1, y: 1, z: 0 }, radius: 3, weak: true };
  let hidden = false;
  const target = { position: { x: 0.5, y: 1, z: 0 }, get radius() { return hidden ? 0 : 1; } };
  expect(pickPrompt([weak, first, equal], eye, null)).toBe(first);
  expect(pickPrompt([equal, first], eye, null)).toBe(equal);
  expect(pickPrompt([{ ...first, radius: 2 }], eye, null)).toBeUndefined();
  expect(pickPrompt([weak, target], eye, null)).toBe(target);
  hidden = true; expect(pickPrompt([weak, target], eye, null)).toBe(weak);
});

it('matches the page picker over actual Vector3 rows without a view dependency in the law', () => {
  for (let i = 0; i < 64; i++) {
    const eye = new Vector3(i / 11, i / 29, -i / 13);
    const list = Array.from({ length: 8 }, (_, j) => ({ position: new Vector3((j * 7 + i) % 13 - 5, j / 3, (j * 5 + i) % 9 - 4),
      radius: (i + j) % 7, weak: j % 3 === 0, label: 'Use', onInteract: () => { throw new Error('Picking must not perform an action'); } }));
    expect(pickPrompt(list, eye, null)).toBe(pickInteractable(list, eye, null));
  }
});

it('admits the actual reconstructed native owner, never an equal-looking unrelated owner or an intervening wall', async () => {
  const physics = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  try {
    const target = { position: { x: 2, y: 0.3, z: 0 }, radius: 3 }, eye = { x: 0, y: 0.3, z: 0 };
    const body = physics.world.createCollider(physics.R.ColliderDesc.cuboid(0.5, 0.5, 0.5).setTranslation(2, 0.3, 0).setCollisionGroups(groups('WORLD')));
    tagCollider(body, 'wood', 'piece:actual-chest'); physics.step();
    setPromptSight(target, { slack: 0.1, body: 'piece:actual-chest' });
    expect(promptVisible(physics, eye, target)).toBe(true);
    expect(pickPrompt([target], eye, physics)).toBe(target);
    setPromptSight(target, { slack: 0.1, body: { id: 'piece:actual-chest' } });
    expect(promptVisible(physics, eye, target)).toBe(false);
    setPromptSight(target, { slack: 0.1, body: 'piece:actual-chest' });
    const wall = physics.world.createCollider(physics.R.ColliderDesc.cuboid(0.1, 1, 1).setTranslation(1, 0.3, 0).setCollisionGroups(groups('WORLD')));
    tagCollider(wall, 'wood', 'piece:wall'); physics.step();
    expect(pickPrompt([target], eye, physics)).toBeUndefined();
  } finally { physics.dispose(); }
});
