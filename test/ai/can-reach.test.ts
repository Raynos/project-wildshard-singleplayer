import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Animal } from '#engine/entities/Animal';
import { AnimalManager } from '#engine/entities/AnimalManager';
import { loadRapier } from '#engine/physics/rapier';
import { Physics } from '#engine/physics/Physics';
import { activePhysics, setActivePhysics } from '#engine/physics/active';
import { groups, type GroupName } from '#engine/physics/groups';
import { tagCollider, untagCollider, type Material } from '#engine/physics/surface';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { invokeLegacy, legacyActor } from '../fake/legacyActor';

let R: Awaited<ReturnType<typeof loadRapier>>;
const previous = activePhysics();
const worlds: Physics[] = [];
beforeAll(async () => { R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
afterEach(() => { setActivePhysics(previous); for (const ph of worlds.splice(0)) { ph.world.forEachCollider(untagCollider); ph.dispose(); } });
function arena(z: number | null, material: Material = 'wood', group: GroupName = 'WORLD'): Physics {
  const ph = new Physics(R); worlds.push(ph);
  if (z !== null) {
    const c = ph.world.createCollider(ph.R.ColliderDesc.cuboid(3, 2, 0.1).setTranslation(0, 1, z).setCollisionGroups(groups(group)));
    tagCollider(c, material);
  }
  ph.step(); setActivePhysics(ph); return ph;
}
function reach(z = 4): boolean {
  const a = legacyActor(Animal.prototype, { position: new THREE.Vector3(0, 0, z), scale: 1,
    dims: { bodyY: 1.2, bodyRadius: 0.3 }, headWorld: (out: THREE.Vector3) => out.set(0, 1.8, z) });
  return invokeLegacy(AnimalManager.prototype, 'canReach', a, new THREE.Vector3()) === true;
}
describe('legacy melee chest-to-attacker occlusion using the real physics query', () => {
  it.each(['wood', 'stone', 'felt', 'metal'] as const)('%s cover vetoes a hit at its contact frame', (material) => {
    arena(2, material); expect(reach()).toBe(false);
  });
  it('no world and a clear world both permit contact', () => {
    setActivePhysics(null); expect(reach()).toBe(true); arena(null); expect(reach()).toBe(true);
  });
  it('creature colliders do not become cover', () => { arena(2, 'flesh', 'CREATURE'); expect(reach()).toBe(true); });
  it('a wall opened after windup immediately permits contact', () => {
    const ph = arena(2); expect(reach()).toBe(false);
    ph.world.forEachCollider((c) => { ph.world.removeCollider(c, false); }); ph.step(); expect(reach()).toBe(true);
  });
  it('endpoint slack permits an attacker touching a wall; a wall nearer the player blocks', () => {
    arena(3.9); expect(reach()).toBe(true); arena(3.4); expect(reach()).toBe(false);
  });
});
