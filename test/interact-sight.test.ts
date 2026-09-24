// PHYSICS P5: interaction needs line of sight — the "[E]" pick is the nearest prompt within its radius that the camera
// can SEE through the Rapier world. A wall between eye and target hides it; the target's own box does not.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { ColliderBridge } from '../src/physics/bridge';
import { groups } from '../src/physics/groups';
import { tagCollider } from '../src/physics/surface';
import { canSee, pickInteractable, setSight } from '../src/world/interact/Interactables';
import type { Interactable } from '../src/world/Cabin';
import type { Collider } from '../src/player/Player';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

const prompt = (x: number, y: number, z: number, radius = 2.5): Interactable => ({ position: new THREE.Vector3(x, y, z), radius, label: 'Open', onInteract: () => { /* the pick never calls it */ } });

/** a 0.3 m thick log wall across x = 1, 3 m tall, 4 m wide */
function wall(ph: Physics): void {
  const c = ph.world.createCollider(ph.R.ColliderDesc.cuboid(0.15, 1.5, 2).setTranslation(1, 1.5, 0).setCollisionGroups(groups('WORLD')));
  tagCollider(c, 'wood', 'wall');
}

describe('interact line of sight', () => {
  const eye = new THREE.Vector3(0, 1.6, 0);

  it('a prompt behind a wall is not picked; with the wall gone it is', async () => {
    const R = await rapier();
    const walled = new Physics(R), open = new Physics(R);
    wall(walled);
    walled.step(); open.step();
    const door = prompt(2, 1.1, 0);
    expect(canSee(walled, eye, door)).toBe(false);
    expect(pickInteractable([door], eye, walled)).toBeUndefined();
    expect(pickInteractable([door], eye, open)).toBe(door);
    // no physics world (boot, node) → distance only, as before
    expect(pickInteractable([door], eye, null)).toBe(door);
  });

  it('the nearest SEEN prompt wins over a nearer one behind the wall', async () => {
    const ph = new Physics(await rapier());
    wall(ph);
    ph.step();
    const hidden = prompt(1.6, 1.1, 0), seen = prompt(-2, 1.1, 0);
    expect(pickInteractable([hidden, seen], eye, ph)).toBe(seen);
  });

  it('keeps the radius rule', async () => {
    const ph = new Physics(await rapier());
    ph.step();
    expect(pickInteractable([prompt(3, 1.6, 0, 2.5)], eye, ph)).toBeUndefined();
  });

  it("the target's own box does not hide it (owner match), a wall in front of the box still does", async () => {
    const ph = new Physics(await rapier());
    // a chest 2 m ahead: its box (the bridge mirrors Collider boxes, tagged with the box as owner) swallows the prompt point
    const box: Collider = { x: 2, z: 0, hw: 0.46, hd: 0.28, rot: 0, yTop: 0.62, yBottom: -0.5 };
    new ColliderBridge(ph, [box]).sync();
    ph.step();
    const chest = prompt(2, 0.3, 0);
    setSight(chest, { slack: 0.1, body: box }); // slack alone would not cover it: the ray meets the box's front face
    expect(canSee(ph, eye, chest)).toBe(true);
    const bare = prompt(2, 0.3, 0);
    setSight(bare, { slack: 0.1 });
    expect(canSee(ph, eye, bare)).toBe(false);
    wall(ph);
    ph.step();
    expect(canSee(ph, eye, chest)).toBe(false);
  });
});
