// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import type { Actor } from '../../src/engine/combat/pipeline';
import type { TargetHit } from '../../src/engine/combat/types';
import type { AnimalManager } from '../../src/engine/entities/AnimalManager';
import { setActivePhysics } from '../../src/engine/physics/active';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { Sabre, SABRE_PROFILE } from '../../src/shards/nalati-grasslands/runtime/weapons/Sabre';
import { Naizagai, NaizagaiPower } from '../../src/shards/nalati-grasslands/runtime/weapons/Naizagai';
import { fakeWorld } from '../fake/world';
import { legacyDouble } from '../fake/FakeGame';
import { digest, isMesh, geometrySum, materialRow, objectRow, mockCanvas, q4, round, v3 } from '../fake/weaponParity';
// oxlint-disable-next-line import/no-nodejs-modules -- The hooked trace admits the shard's actual immutable module bytes.
import { readFileSync } from 'node:fs';
import type { WeaponHooks } from '../../src/game/systems/items/weaponHooks';
import { createWeaponHookLane, parseWeaponHooks } from '../../src/game/shardfile/weaponHooks';
import hookDeclaration from '../../src/shards/nalati-grasslands/behaviour/weapons.json';

/**
 * SHARD-PLATFORM SF36: Nalati's sabre and its Naizagai reward as rows over the platform's mounted sword. The trace was
 * pinned from the pre-SF36 `class Sabre extends Sword` / `class Naizagai extends Sabre` (HEAD 275bb16b2) and must stay
 * equal: twenty scripted seconds of the on-foot combo, a held heavy, the saddle's pass slashes on both sides with their
 * chain, a heavy in the saddle, a gallop (Naizagai's crescent and arcs), a heavy on foot (its called bolt), a dead and a
 * revived target, portrait, sprint and holster, recording the viewmodel's every part, the scene (stars, trail, crescent,
 * arcs, ring), the hits and damage, the pass chain, the camera's FOV and the built geometry and materials.
 * The sabre's pass damage on Nalati's admitted AssemblyScript hook (behaviour/weapons.as) plays the same trace.
 */
beforeEach(() => { app.rng.seed(11); setActivePhysics(null); setAimTargets([]); mockCanvas(); });
afterEach(() => { setActivePhysics(null); setAimTargets([]); vi.restoreAllMocks(); });

/** A target that is at once an aim target, a sweep target and the power's creature: a sphere with a running health. */
interface Dummy {
  kind: string; alive: boolean; hidden: boolean; position: THREE.Vector3; scale: number; radius: number; hp: number;
  dims: { bodyY: number; bodyRadius: number; bodyHalfLen: number }; mem: Record<string, number>;
  applyDamage: (amount: number, point: THREE.Vector3, dir: THREE.Vector3) => boolean;
  headWorld: (out: THREE.Vector3) => THREE.Vector3; combatActor: () => Actor;
  stagger: (dir: THREE.Vector3, k: number) => void; hitFlash: (k: number) => void; damageFor: () => number;
}

/** The scripted twenty seconds: the snapshot row and the event list. */
function trace(which: 'sabre' | 'naizagai', hooks: WeaponHooks | null = null): { row: unknown; events: unknown[] } {
  app.rng.seed(11);
  const f = fakeWorld(), game = f.game.asGame();
  Reflect.set(f.player, 'mountedOn', null); // the power never hits the horse you ride
  const events: unknown[] = [];
  const dummy = (kind: string, x: number, y: number, z: number, hp: number): Dummy => {
    const d: Dummy = {
      kind, alive: true, hidden: false, position: new THREE.Vector3(x, y, z), scale: 1, radius: 0.75, hp,
      dims: { bodyY: 0.2, bodyRadius: 0.5, bodyHalfLen: 0.6 }, mem: {},
      applyDamage: (amount, point, dir) => {
        d.hp -= amount; events.push(['damage', kind, round(amount), ...v3(point), ...v3(dir), round(d.hp)]);
        if (d.hp <= 0) { d.alive = false; return true; }
        return false;
      },
      headWorld: (out) => out.copy(d.position).setY(d.position.y + 0.3),
      combatActor: () => ({ id: `target.${kind}`, tags: ['actor.creature', `creature.${kind}`], state: [], attributes: { health: d.hp, maxHealth: 1000 },
        get alive() { return d.alive; }, applyDamage: (req) => d.applyDamage(req.amount, req.point, req.dir) }),
      stagger: (dir, k) => { events.push(['stagger', kind, ...v3(dir), round(k)]); },
      hitFlash: (k) => { events.push(['flash', kind, round(k)]); },
      damageFor: () => 1,
    };
    return d;
  };
  const right = dummy('wolf', 1.5, 1.2, -1.3, 400), left = dummy('boar', -1.5, 1.2, -1.3, 400), ahead = dummy('balbal', 0.2, 1.3, -9, 90);
  const all = [right, left, ahead];
  setAimTargets(all);
  const sphere = new THREE.Sphere(), ray = new THREE.Ray(), at = new THREE.Vector3();
  const raycast = (origin: THREE.Vector3, dir: THREE.Vector3, max: number): TargetHit | null => {
    let best: TargetHit | null = null;
    ray.set(origin, dir);
    for (const a of all) {
      if (!a.alive) continue;
      sphere.set(a.position, a.radius);
      if (ray.intersectSphere(sphere, at) === null) continue;
      const distance = at.distanceTo(origin);
      if (distance <= max && (best === null || distance < best.distance)) best = { animal: a, point: at.clone(), distance, headshot: at.y > a.position.y + 0.3 };
    }
    return best;
  };
  const world = { game, sky: f.sky, player: f.player, forest: f.forest };
  let storm = false;
  const animals = legacyDouble<AnimalManager>({}); Reflect.set(animals, 'animals', all); // the power reads only the list
  const power = new NaizagaiPower({ scene: game.scene, player: f.player, camera: game.camera,
    animals, storm: () => storm, bolt: (x, y, z) => { events.push(['bolt', round(x), round(y), round(z)]); } });
  const sabre = which === 'sabre' ? new Sabre(world, { raycast }, { allowUnlocked: true }) : new Naizagai(world, { raycast }, { allowUnlocked: true, power });
  sabre.hooks = hooks;
  sabre.onFire = () => { events.push(['fire', sabre.swingName]); };
  sabre.onHit = (kind, headshot, killed) => { events.push(['hit', kind, headshot, killed, sabre.passChain]); };
  sabre.onImpact = (surface, point) => { events.push(['impact', surface, ...v3(point)]); };
  const cam = game.camera;
  const built = { children: sabre.model.children.length, row: [sabre.row.id, sabre.meta.name], meshes: [] as unknown[] };
  sabre.model.traverse((o) => { if (isMesh(o)) built.meshes.push({ geo: geometrySum(o.geometry), verts: o.geometry.getAttribute('position').count, order: o.renderOrder, mat: materialRow(o.material) }); });
  const frames: unknown[] = [];
  const dt = 1 / 60;
  for (let i = 0; i < 1200; i++) {
    const t = i * dt;
    f.player.bobTime = t * 9; f.player.speedFactor = i < 300 ? 0.5 : 0;
    f.player.yaw = Math.sin(t * 0.7) * 0.25; f.player.pitch = -0.1 + Math.sin(t * 0.4) * 0.05;
    f.player.sprinting = i >= 1010 && i < 1060;
    sabre.mount = i >= 300 && i < 900 ? { speed: i < 450 ? 6 + (i - 300) / 50 : i < 620 ? 12.5 : 7, yaw: i < 700 ? 0 : 0.35 } : null;
    sabre.adsHeld = (i >= 160 && i < 200) || (i >= 640 && i < 690) || (i >= 920 && i < 970);
    sabre.holster = i >= 1140 ? Math.min(1, (i - 1140) / 30) : 0;
    if (i === 520) storm = true;
    if (i === 740) { right.alive = false; }
    if (i === 820) { right.alive = true; right.hp = 400; }
    if (i === 1000) { cam.aspect = 0.46; cam.updateProjectionMatrix(); }
    if ((i >= 20 && i < 140 && i % 18 === 0) || i === 260 || i === 280) sabre.tryFire();
    if (i >= 310 && i < 880 && i % 25 === 0) sabre.tryFire();
    if (i >= 990 && i < 1100 && i % 30 === 0) sabre.tryFire();
    sabre.update(dt, t);
    power.update(dt, t);
    const scene: unknown[] = [];
    for (const o of game.scene.children) if (o.visible && o !== cam) scene.push(objectRow(o));
    frames.push({
      i, swing: sabre.swingName, heavy: sabre.heavySwing, charging: sabre.chargingHeavy, damage: sabre.damage, chain: sabre.passChain,
      chainLeft: round(sabre.passChainLeft), mounted: sabre.mounted, fov: round(cam.fov), hp: all.map((a) => [a.alive ? 1 : 0, round(a.hp)]),
      model: [...v3(sabre.model.position), ...q4(sabre.model.quaternion), round(sabre.model.scale.x), sabre.model.visible ? 1 : 0],
      parts: sabre.model.children.map(objectRow),
      viewmodel: game.viewmodel.children.filter((o) => o !== sabre.model).map(objectRow),
      scene,
    });
  }
  // reward replacement carries the riding clock and the heavy's strength
  sabre.mount = { speed: 9, yaw: 0.2 }; sabre.heavyMult = 1.3;
  const next = new Sabre(world, { raycast }, { allowUnlocked: true }); next.carryPassState(sabre);
  const carried = [next.mount, next.passChain, round(next.passChainLeft), next.heavyMult, next.mounted];
  // Every frame is in the digest; a window of 30 frames per digest keeps a mismatch locatable and the snapshot small.
  const windows: string[] = [];
  for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
  return { row: { built, events: digest(JSON.stringify(events)), eventCount: events.length, carried, last: frames.at(-1), windows }, events };
}

describe('the sabre and Naizagai on the mounted sword family keep their pre-SF36 trace', () => {
  it.each(['sabre', 'naizagai'] as const)('%s builds the same viewmodel and plays the same scripted twenty seconds', (which) => {
    const { row, events } = trace(which);
    expect(row).toMatchSnapshot();
    // the trace walked the scene it claims: combo, heavy, both pass sides, a chain, kills (the balbal ahead)
    const fired = events.filter((e): e is unknown[] => Array.isArray(e) && e[0] === 'fire').map((e) => e[1]);
    for (const want of ['slash', 'backhand', 'finisher', 'heavy', 'pass-left', 'pass-right']) expect(fired, want).toContain(want);
    expect(Math.max(...events.filter((e): e is unknown[] => Array.isArray(e) && e[0] === 'hit').map((e) => Number(e[4])))).toBeGreaterThan(1);
    if (which === 'naizagai') {
      expect(events.some((e) => Array.isArray(e) && e[0] === 'bolt')).toBe(true);
      expect(events.some((e) => Array.isArray(e) && e[0] === 'damage' && e[2] === 50)).toBe(true); // a storm crescent
    }
  });
  it('the sabre on Nalati\'s admitted weapon hook plays the same twenty seconds', async () => {
    const data = parseWeaponHooks(hookDeclaration);
    // the hook's parameters are the row's chain numbers: the row rule stays the fallback and they cannot drift apart
    expect(data.parameters).toEqual([SABRE_PROFILE.mounted.speedDivisor, SABRE_PROFILE.mounted.chainStep, SABRE_PROFILE.mounted.chainMax]);
    const lane = await createWeaponHookLane(data, readFileSync(`src/shards/nalati-grasslands/assets/${data.module}`));
    const hooks = lane.hooks('weapon.sabre'), answers: (number | null)[] = [];
    const counted: WeaponHooks = { damage: (input) => { const value = hooks.damage(input); answers.push(value); return value; } };
    expect(trace('sabre', counted)).toEqual(trace('sabre'));
    expect(answers.length).toBeGreaterThanOrEqual(10);
    expect(answers.every((value) => value !== null)).toBe(true); // the script answered every pass (none fell back)
    expect(new Set(answers).size).toBeGreaterThan(2); // speed and chain both moved the answer
    expect(lane.host.checkpoint().modules.map((module) => [module.failures, module.disabled])).toEqual([[0, false]]);
    expect(() => lane.hooks('weapon.naizagai')).toThrow(/Undeclared/u);
  });
});
