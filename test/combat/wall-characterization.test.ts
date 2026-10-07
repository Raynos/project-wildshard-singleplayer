import { CROSSBOW_PROFILE } from '../../src/shards/pine-hollow/weapons/crossbow/profiles';
import { EliteBrain } from '../../src/engine/ai/EliteBrain';
import { app } from '../../src/engine/app/runtime';
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { getActiveChunk, setActiveChunk } from '../../src/game/shard/registry';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { LaneCharge } from '../../src/shards/pine-hollow/combat/ctx';
import { AntlerKingFight } from '../../src/shards/pine-hollow/runtime/antlerKing';
import { canReach } from '../../src/engine/ai/reach';
import { headingTo, inArc } from '../../src/shards/pine-hollow/combat/combatMath';
import { pineContact, PINE_STRIKES } from '../../src/shards/pine-hollow/combat/strikes';
import { blackpawGoal } from '../../src/shards/pine-hollow/combat/EliteGoals';
import { legacyMethods } from '../fake/legacySource';
import { Spear, SPEAR_PROFILE } from '../../src/shards/nalati-grasslands/weapons/Spear';
import { NaizagaiPower } from '../../src/shards/nalati-grasslands/weapons/Naizagai';
import { Projectiles } from '../../src/engine/combat/view/projectile';
import { Crossbow } from '../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { loadRapier } from '../../src/engine/physics/rapier';
import { Physics } from '../../src/engine/physics/Physics';
import { activePhysics, setActivePhysics } from '../../src/engine/physics/active';
import { groups } from '../../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { damageTarget, legacyActor, invokeLegacy } from '../fake/legacyActor';
import { fakeWorld } from '../fake/world';
import { manager } from '../fake/manager';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
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
    ['bear', 'brown', 45], ['bear', 'black-old', 42], ['bear', 'brown-old', 55]] as const)('B4 Pine %s/%s rejects cabin cover and retains%s in the open', (kind, variant, damage) => {
      setActiveChunk('pine-hollow'); wall(); const f = manager(), a = f.manager.spawn(kind, 0, -2.5, 0, variant);
      const brains: unknown = Reflect.get(f.manager, 'brains'); if (!(brains instanceof Map)) throw new Error('brains moved');
      const brain: unknown = brains.get(a); if (typeof brain !== 'object' || brain === null) throw new Error('brain missing');
      Object.assign(brain, { windup: 0, timer: 10 }); a.state = 'charge';
      const hits: number[] = []; f.manager.onCharge = (_animal, amount) => { hits.push(amount); };
      invokeLegacy(f.manager, 'advanceCharge', a, 0.1, new THREE.Vector3(0, 0, -1.2));
      expect(hits).toEqual([]);
      setActivePhysics(null); invokeLegacy(f.manager, 'advanceCharge', a, 0.1, new THREE.Vector3(0, 0, -1.2));
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
  it('B4 Pine elite lane rejects cover and retains30 after it opens', () => {
    setActiveChunk('pine-hollow'); wall(); const f = manager(), a = f.manager.spawn('boar', 0, -2.5, 0, 'boar');
    const p = new THREE.Vector3(0, 0, -1.2), hits: number[] = [];
    const lane = new LaneCharge(f.game.scene, 0xff4400, { width: 2.4, speed: 12.5, overshoot: 7, dmg: 30, skid: 1.1, reach: 1.7 }, (actor, point) => canReach(actor, point, activePhysics()));
    lane.start(a, p.x, p.z, 0.9); lane.update(a, 0.9, 0.9, p, (amount) => { hits.push(amount); });
    lane.update(a, 1 / 60, 1, p, (amount) => { hits.push(amount); }); lane.update(a, 1 / 60, 1.1, p, (amount) => { hits.push(amount); });
    expect(hits).toEqual([]);
    setActivePhysics(null); lane.update(a, 1 / 60, 1.2, p, (amount) => { hits.push(amount); });
    lane.update(a, 1 / 60, 1.3, p, (amount) => { hits.push(amount); }); expect(hits).toEqual([30]);
  });
  it('B4 Antler sweep rejects a log and retains24 in the open', () => {
    setActiveChunk('pine-hollow'); wall(); const f = manager(), a = f.manager.spawn('boar', 0, -2.5, 0, 'boar');
    const hurt = vi.fn(noop), fight = legacyActor(AntlerKingFight.prototype, {
      mode: 'sweep', modeT: 0.9, open: 0, sweepCd: 0, stompCd: 10, callCd: 10,
      ctx: { reach: (actor: Animal, point: THREE.Vector3) => canReach(actor, point, activePhysics()), player: { position: new THREE.Vector3(0, 0, -1.2) }, hurt, trauma: noop },
      tellRing: { setTime: noop, ring: noop, hide: noop }, tickWaves: noop,
    });
    invokeLegacy(fight, 'fight', a, 1 / 60, 0); expect(hurt).not.toHaveBeenCalled();
    setActivePhysics(null); Reflect.set(fight, 'mode', 'sweep'); Reflect.set(fight, 'modeT', 0.9);
    invokeLegacy(fight, 'fight', a, 1 / 60, 1); expect(hurt).toHaveBeenCalledExactlyOnceWith(a, 24);
  });
  it('B4 Blackpaw swipe rejects cover and retains22 in the open', () => {
    setActiveChunk('pine-hollow'); wall(); const f = manager(), a = f.manager.spawn('boar', 0, -2.5, 0, 'boar');
    const path = 'src/shards/pine-hollow/combat/elites.ts', globals = { canReach, headingTo, inArc, pineContact, PINE_STRIKES, blackpawGoal, THREE, voice: noop, _v: new THREE.Vector3() };
    const proto = legacyMethods(path, 'Blackpaw', globals), base = legacyMethods(path, 'PineElite', globals);
    Object.setPrototypeOf(base, EliteBrain.prototype); Object.setPrototypeOf(proto, base);
    const hurt = vi.fn(noop), fight = legacyActor(proto, { ports: { player: { position: new THREE.Vector3(0, 0, -1.2) } }, mode: 'swipe', modeT: 0, swipeT: 0.01, roarCd: 0, p2: false,
      env: { reach: (actor: Animal, point: THREE.Vector3) => canReach(actor, point, activePhysics()), player: { position: new THREE.Vector3(0, 0, -1.2) }, hurt, trauma: noop }, ring: { setTime: noop, hide: noop } });
    invokeLegacy(fight, 'fight', a, 0.02, 0); expect(hurt).not.toHaveBeenCalled();
    setActivePhysics(null); Reflect.set(fight, 'swipeT', 0.01);
    invokeLegacy(fight, 'fight', a, 0.02, 1); expect(hurt).toHaveBeenCalledExactlyOnceWith(a, 22, false);
  });
  it('B1 thrust rejects a registered yurt wall and retains30 in the open', () => {
    wall(); const f = fakeWorld(), a = target();
    const spear = legacyActor(Spear.prototype, { combat: app.combat, row: SPEAR_PROFILE, profile: SPEAR_PROFILE, player: f.player, game: f.game.asGame(), targets: { raycast: a.raycast }, onHit: undefined, onImpact: undefined });
    invokeLegacy(spear, 'thrustHit'); expect(a.dealt).toEqual([]);
    setActivePhysics(null); invokeLegacy(spear, 'thrustHit'); expect(a.dealt).toEqual([30]);
  });
  it('B1 lance rejects cover and preserves clear-path damage', () => {
    wall(); const f = fakeWorld(), a = target(); setAimTargets([a.animal]);
    const prev = a.animal.position.clone();
    const spear = legacyActor(Spear.prototype, { combat: app.combat, row: SPEAR_PROFILE, profile: SPEAR_PROFILE, player: f.player, game: f.game.asGame(), targets: { raycast: a.raycast },
      mount: { yaw: 0, speed: 8 }, prevPos: new Map([[a.animal, prev]]), rehit: new Map(), onHit: undefined, onImpact: undefined });
    invokeLegacy(spear, 'contacts', 1 / 60, 1);
    expect(a.dealt).toEqual([]);
    setActivePhysics(null); spear.mount = { yaw: 0, speed: 8 };
    invokeLegacy(spear, 'contacts', 1 / 60, 1); expect(a.dealt).toEqual([88]);
  });
  it('B2 Naizagai rejects a crag and preserves40 to a creature10m out in the open', () => {
    wall(); const f = fakeWorld(), a = target(); a.animal.position.z = a.body.z = a.head.z = -10;
    const blade = legacyActor(NaizagaiPower.prototype, { crescent: new THREE.Object3D(), crescentFrom: new THREE.Vector3(), crescentDir: new THREE.Vector3(), arcs: [],
      deps: { camera: f.game.camera, player: { mountedOn: null }, animals: { animals: [a.animal] }, storm: () => false } });
    invokeLegacy(blade, 'throwCrescent'); expect(a.dealt).toEqual([]);
    setActivePhysics(null); invokeLegacy(blade, 'throwCrescent'); expect(a.dealt).toEqual([40]);
  });
  it.each([false, true])('B2 Naizagai storm%s stops its arcs at cover from a clear first target', (storm) => {
    wall(); const f = fakeWorld(), first = target(), next = target(), third = target();
    for (const [a, z] of [[first, -1], [next, -3], [third, -5]] as const) {
      a.animal.position.z = a.body.z = a.head.z = z;
    }
    const blade = legacyActor(NaizagaiPower.prototype, { crescent: new THREE.Object3D(), crescentFrom: new THREE.Vector3(), crescentDir: new THREE.Vector3(), arcs: [],
      deps: { camera: f.game.camera, player: { mountedOn: null }, animals: { animals: [first.animal, next.animal, third.animal] }, storm: () => storm } });
    invokeLegacy(blade, 'throwCrescent');
    expect(first.dealt).toEqual([storm ? 50 : 40]); expect(next.dealt).toEqual([]); expect(third.dealt).toEqual([]);
    setActivePhysics(null); invokeLegacy(blade, 'throwCrescent');
    expect(first.dealt).toEqual([storm ? 50 : 40, storm ? 50 : 40]); expect(next.dealt).toEqual([storm ? 50 : 40]); expect(third.dealt).toEqual(storm ? [50] : []);
  });
  it.each(['arrow', 'bolt'])('%s already stops at the same registered wall before querying the creature', (kind) => {
    wall(); const f = fakeWorld(), a = target(), from = new THREE.Vector3(0, 0.8, 0), to = new THREE.Vector3(0, 0.8, -3);
    const weapon = kind === 'arrow'
      ? legacyActor(Projectiles.prototype, { kind: {}, targets: { raycast: a.raycast }, stop: noop, onImpact: undefined })
      : legacyActor(Crossbow.prototype, { onBoltHit: () => undefined, profile: CROSSBOW_PROFILE, game: f.game.asGame(), targets: { raycast: a.raycast }, stopBolt: noop, onImpact: undefined });
    invokeLegacy(weapon, 'testHit', kind === 'arrow' ? { pos: to, origin: from, scale: 1 } : { pos: to, mod: {} }, from);
    expect(a.dealt).toEqual([]);
  });
});
