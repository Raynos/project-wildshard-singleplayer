import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Heightfield from '#engine/world/Heightfield';
import { getActiveChunk, setActiveChunk } from '#game/shard/registry';
import { LaneCharge } from '#shards/pine-hollow/combat/ctx';
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
import { manager } from '../fake/manager';

vi.mock('#engine/world/Heightfield', async (original) => ({ ...await original<typeof Heightfield>(),
  heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null }));
const originalChunk = getActiveChunk().slug;

let R: Awaited<ReturnType<typeof loadRapier>>;
const previous = activePhysics(); let ph: Physics | null = null;
beforeAll(async () => { R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
afterEach(() => { setActiveChunk(originalChunk); setAimTargets([]); setActivePhysics(previous); ph?.dispose(); ph = null; });
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
  it.each([['boar', 'boar', 25], ['boar', 'sow', 25], ['boar', 'black', 25], ['boar', 'big', 25],
    ['boar', 'scarback', 32], ['boar', 'ironhide', 40], ['bear', 'black', 35], ['bear', 'black-blaze', 35],
    ['bear', 'brown', 45], ['bear', 'black-old', 42], ['bear', 'brown-old', 55]] as const)('B4 Pine %s/%s currently charges through cover for%s', (kind, variant, damage) => {
      setActiveChunk('pine-hollow'); wall(); const f = manager(), a = f.manager.spawn(kind, 0, -2.5, 0, variant);
      const brains: unknown = Reflect.get(f.manager, 'brains'); if (!(brains instanceof Map)) throw new Error('brains moved');
      const brain: unknown = brains.get(a); if (typeof brain !== 'object' || brain === null) throw new Error('brain missing');
      Object.assign(brain, { windup: 0, timer: 10 }); a.state = 'charge';
      const hits: number[] = []; f.manager.onCharge = (_animal, amount) => { hits.push(amount); };
      invokeLegacy(f.manager, 'think', a, 0.1, new THREE.Vector3(0, 0, -1.2), false);
      expect(hits).toEqual([damage]);
    });
  it('S8 Driftwood charge contact already checks registered cover', () => {
    setActiveChunk('driftwood-isle'); wall(); const f = manager(), a = f.manager.spawn('boar', 0, -2.5, 0, 'boar');
    const brains: unknown = Reflect.get(f.manager, 'brains'); if (!(brains instanceof Map)) throw new Error('brains moved');
    const brain: unknown = brains.get(a); if (typeof brain !== 'object' || brain === null) throw new Error('brain missing');
    Object.assign(brain, { windup: 0 }); a.state = 'charge';
    const hit = vi.fn(noop); f.manager.onCharge = hit;
    invokeLegacy(f.manager, 'chargeContact', a, new THREE.Vector3(0, 0, -1.2)); expect(hit).not.toHaveBeenCalled();
    setActivePhysics(null); invokeLegacy(f.manager, 'chargeContact', a, new THREE.Vector3(0, 0, -1.2));
    expect(hit).toHaveBeenCalledWith(a, 25);
  });
  it('B4 Pine elite lane currently deals30 through the same cover once', () => {
    setActiveChunk('pine-hollow'); wall(); const f = manager(), a = f.manager.spawn('boar', 0, -2.5, 0, 'boar');
    const p = new THREE.Vector3(0, 0, -1.2), hits: number[] = [];
    const lane = new LaneCharge(f.game.scene, 0xff4400, { width: 2.4, speed: 12.5, overshoot: 7, dmg: 30, skid: 1.1, reach: 1.7 });
    lane.start(a, p.x, p.z, 0.9); lane.update(a, 0.9, 0.9, p, (amount) => { hits.push(amount); });
    lane.update(a, 1 / 60, 1, p, (amount) => { hits.push(amount); }); lane.update(a, 1 / 60, 1.1, p, (amount) => { hits.push(amount); });
    expect(hits).toEqual([30]);
  });
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
