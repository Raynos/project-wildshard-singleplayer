import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Spear } from '#shards/nalati-grasslands/weapons/Spear';
import { Naizagai } from '#shards/nalati-grasslands/weapons/Naizagai';
import { Projectiles } from '#engine/player/Projectiles';
import { Crossbow } from '#engine/player/Crossbow';
import { setAimTargets } from '#engine/player/AimTargets';
import { loadRapier } from '#engine/physics/rapier';
import { Physics } from '#engine/physics/Physics';
import { activePhysics, setActivePhysics } from '#engine/physics/active';
import { groups } from '#engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { damageTarget, legacyActor, invokeLegacy } from '../fake/legacyActor';
import { fakeWorld } from '../fake/world';

let R: Awaited<ReturnType<typeof loadRapier>>;
const previous = activePhysics(); let ph: Physics | null = null;
beforeAll(async () => { R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
afterEach(() => { setAimTargets([]); setActivePhysics(previous); ph?.dispose(); ph = null; });
const noop = (): void => undefined;
function wall(): void {
  ph = new Physics(R); ph.world.createCollider(ph.R.ColliderDesc.cuboid(4, 3, 0.1).setTranslation(0, 0, -1.25).setCollisionGroups(groups('WORLD')));
  ph.step(); setActivePhysics(ph);
}
function target() {
  const a = damageTarget(); a.animal.position.z = a.body.z = a.head.z = -2.5;
  Reflect.set(a.animal, 'hidden', false); Reflect.set(a.animal, 'mem', {}); Reflect.set(a.animal, 'stagger', noop);
  const raycast = (_origin: THREE.Vector3, _dir: THREE.Vector3, max: number) => max >= 2.5 ? { animal: a.animal, point: a.body, distance: 2.5, headshot: false } : null;
  return { ...a, raycast };
}
describe('wall bug baselines (owning migrations intentionally change B1/B2 expectations)', () => {
  it('B1 thrust currently damages30 through a registered yurt wall', () => {
    wall(); const f = fakeWorld(), a = target();
    const spear = legacyActor(Spear.prototype, { game: f.game.asGame(), targets: { raycast: a.raycast }, onHit: undefined, onImpact: undefined });
    invokeLegacy(spear, 'thrustHit'); expect(a.dealt).toEqual([30]);
  });
  it.each([false, true])('B1 lance%s / brace currently damages through registered cover', (lance) => {
    wall(); const f = fakeWorld(), a = target(); setAimTargets([a.animal]);
    const prev = a.animal.position.clone(); if (!lance) prev.z -= 0.1;
    const spear = legacyActor(Spear.prototype, { player: f.player, game: f.game.asGame(), targets: { raycast: a.raycast },
      mount: lance ? { yaw: 0, speed: 8 } : null, prevPos: new Map([[a.animal, prev]]), rehit: new Map(), onHit: undefined, onImpact: undefined });
    invokeLegacy(spear, 'contacts', 1 / 60, 1, lance);
    expect(a.dealt).toEqual([lance ? 88 : 108]);
  });
  it('B2 Naizagai currently deals40 through a crag to a creature10m out', () => {
    wall(); const f = fakeWorld(), a = target(); a.animal.position.z = a.body.z = a.head.z = -10;
    const blade = legacyActor(Naizagai.prototype, { crescent: new THREE.Object3D(), crescentFrom: new THREE.Vector3(), crescentDir: new THREE.Vector3(), arcs: [],
      deps: { camera: f.game.camera, animals: { animals: [a.animal] }, storm: () => false } });
    invokeLegacy(blade, 'throwCrescent'); expect(a.dealt).toEqual([40]);
  });
  it.each(['arrow', 'bolt'])('%s already stops at the same registered wall before querying the creature', (kind) => {
    wall(); const f = fakeWorld(), a = target(), from = new THREE.Vector3(0, 0.8, 0), to = new THREE.Vector3(0, 0.8, -3);
    const weapon = kind === 'arrow'
      ? legacyActor(Projectiles.prototype, { kind: {}, targets: { raycast: a.raycast }, stop: noop, onImpact: undefined })
      : legacyActor(Crossbow.prototype, { game: f.game.asGame(), targets: { raycast: a.raycast }, stopBolt: noop, onImpact: undefined });
    invokeLegacy(weapon, 'testHit', kind === 'arrow' ? { pos: to, origin: from, scale: 1 } : { pos: to, mod: {} }, from);
    expect(a.dealt).toEqual([]);
  });
});
