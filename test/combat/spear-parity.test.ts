// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Vitest executes in Node; happy-dom supplies only DOM globals.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the installed WASM outside a symlinked clean export in this Node test.
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import type { TargetHit } from '../../src/engine/combat/types';
import { activePhysics, setActivePhysics } from '../../src/engine/physics/active';
import { groups } from '../../src/engine/physics/groups';
import { Physics } from '../../src/engine/physics/Physics';
import { loadRapier } from '../../src/engine/physics/rapier';
import { tagCollider } from '../../src/engine/physics/surface';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { Spear } from '../../src/shards/nalati-grasslands/runtime/weapons/Spear';
import { fakeWorld } from '../fake/world';
import { digest, isMesh, geometrySum, materialRow, objectRow, mockCanvas, q4, round, v3 } from '../fake/weaponParity';

/**
 * SHARD-PLATFORM SF36: Nalati's spear and javelins as a row over the platform's spear family. The trace was pinned from
 * the pre-SF36 `class Spear extends Melee` (HEAD 662a12434) and must stay equal: twenty scripted seconds of thrusts (one
 * queued), javelin throws into a real Rapier range (stuck in a wood wall, off a stone wall onto the ground, into the turf,
 * into two creatures, one with a sneak multiplier), a dry throw, the throw arc, the couched lance in the saddle against
 * an approaching creature, a throw from the saddle, walking over the javelins to pick them up, portrait, sprint, inspect
 * and holster, recording the viewmodel's every part (both rigs, the held javelin, the sleeves), the scene (world
 * javelins, the arc), the hits, impacts, damage and pickups, the camera's FOV, the HUD state and the built geometry.
 * Re-recorded from frame 210 on (windows 7+) when the stick fix landed: the pre-SF36 spear placed a javelin stuck in wood
 * or turf 0.42 m from the world origin (its `at` aliased the flight's temporary), so it was picked up at once; now it sits
 * at its impact point, which every wood / ground impact asserts, and the walk picks two up.
 */
let R: Awaited<ReturnType<typeof loadRapier>>;
const previousPhysics = activePhysics();
let ph: Physics | null = null;
beforeAll(async () => { R = await loadRapier(readFileSync(createRequire(import.meta.url).resolve('@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm'))); });
afterAll(() => { setActivePhysics(previousPhysics); });
beforeEach(() => { app.rng.seed(11); setActivePhysics(null); setAimTargets([]); mockCanvas(); });
afterEach(() => { setActivePhysics(null); ph?.dispose(); ph = null; setAimTargets([]); vi.restoreAllMocks(); });

/** The range: a wood wall left and a stone wall right 12 m out, the ground under everything (half extents, centre). */
const BOXES: readonly (readonly [number, number, number, number, number, number, Parameters<typeof tagCollider>[1]])[] = [
  [3, 5, 0.2, -4, 2, -12, 'wood'], [3, 5, 0.2, 4, 2, -12, 'stone'], [40, 0.5, 40, 0, -0.5, -10, 'ground'],
];
function range(): Physics {
  const p = new Physics(R);
  for (const [hx, hy, hz, x, y, z, material] of BOXES) {
    const c = p.world.createCollider(p.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setCollisionGroups(groups('WORLD')));
    tagCollider(c, material, null);
  }
  p.step();
  return p;
}
/** how far a point is from the range's nearest box (0 inside one) */
function offRange(at: THREE.Vector3): number {
  let best = Infinity;
  for (const [hx, hy, hz, x, y, z] of BOXES) {
    best = Math.min(best, Math.hypot(Math.max(0, Math.abs(at.x - x) - hx), Math.max(0, Math.abs(at.y - y) - hy), Math.max(0, Math.abs(at.z - z) - hz)));
  }
  return best;
}

interface Dummy {
  kind: string; alive: boolean; hidden: boolean; position: THREE.Vector3; scale: number; radius: number; hp: number;
  dims: { bodyY: number; bodyRadius: number; bodyHalfLen: number };
  applyDamage: (amount: number, point: THREE.Vector3, dir: THREE.Vector3) => boolean;
  stagger: (dir: THREE.Vector3, k: number) => void; damageFor: () => number;
}

describe('the spear on the spear family keeps its pre-SF36 trace', () => {
  it('builds the same viewmodel and plays the same scripted twenty seconds of thrusts, throws and the lance', () => {
    ph = range(); setActivePhysics(ph);
    const f = fakeWorld(), game = f.game.asGame();
    Reflect.set(f.player, 'waterSurfaceAt', () => null);
    Reflect.set(f.player, 'moveScale', 1);
    const events: unknown[] = [];
    const dummy = (kind: string, x: number, z: number, hp: number): Dummy => {
      const d: Dummy = {
        kind, alive: true, hidden: false, position: new THREE.Vector3(x, 0, z), scale: 1, radius: 0.55, hp,
        dims: { bodyY: 0.7, bodyRadius: 0.45, bodyHalfLen: 0.6 },
        applyDamage: (amount, point, dir) => {
          d.hp -= amount; events.push(['damage', kind, round(amount), ...v3(point), ...v3(dir), round(d.hp)]);
          if (d.hp <= 0) { d.alive = false; return true; }
          return false;
        },
        stagger: (dir, k) => { events.push(['stagger', kind, ...v3(dir), round(k)]); },
        damageFor: () => 1,
      };
      return d;
    };
    const close = dummy('wolf', 0.15, -2.4, 500), far = dummy('boar', -2.5, -8, 500), runner = dummy('saiga', -0.6, -9, 500);
    runner.hidden = true;
    const all = [close, far, runner];
    setAimTargets(all);
    const sphere = new THREE.Sphere(), ray = new THREE.Ray(), at = new THREE.Vector3(), centre = new THREE.Vector3();
    const raycast = (origin: THREE.Vector3, dir: THREE.Vector3, max: number): TargetHit | null => {
      let best: TargetHit | null = null;
      ray.set(origin, dir);
      for (const a of all) {
        if (!a.alive || a.hidden) continue;
        sphere.set(centre.copy(a.position).setY(a.position.y + a.dims.bodyY), a.radius);
        if (ray.intersectSphere(sphere, at) === null) continue;
        const distance = at.distanceTo(origin);
        if (distance <= max && (best === null || distance < best.distance)) best = { animal: a, point: at.clone(), distance, headshot: at.y > centre.y + 0.3 };
      }
      return best;
    };
    const spear = new Spear({ game, sky: f.sky, player: f.player, forest: f.forest }, { raycast }, { allowUnlocked: true });
    spear.damageMultiplier = (hit) => hit.animal.kind === 'boar' ? 2 : 1;
    spear.onFire = () => { events.push(['fire']); };
    spear.onThrow = () => { events.push(['throw', spear.javelins]); };
    spear.onHit = (kind, headshot, killed) => { events.push(['hit', kind, headshot, killed]); };
    const landed: THREE.Vector3[] = [];  // this frame's wood / ground impacts: a javelin stuck or lying there
    spear.onImpact = (surface, point) => { events.push(['impact', surface, ...v3(point)]); if (surface !== 'flesh') landed.push(point.clone()); };
    spear.onDry = () => { events.push(['dry']); };
    spear.onPickup = (n) => { events.push(['pickup', n]); };
    const cam = game.camera;
    const built = { children: spear.model.children.length, meshes: [] as unknown[] };
    spear.model.traverse((o) => { if (isMesh(o)) built.meshes.push({ geo: geometrySum(o.geometry), verts: o.geometry.getAttribute('position').count, order: o.renderOrder, mat: materialRow(o.material) }); });
    const frames: unknown[] = [];
    let stuckChecks = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 1200; i++) {
      const t = i * dt;
      f.player.bobTime = t * 9; f.player.speedFactor = i < 300 ? 0.5 : 0;
      // aim: ahead for the thrusts, left at the wood, right at the stone, down at the turf, at the far boar
      f.player.yaw = i < 150 ? Math.sin(t) * 0.03 : i < 230 ? 0.33 : i < 310 ? -0.33 : i < 400 ? 0.02 : i < 500 ? 0.3 : Math.sin(t * 0.5) * 0.05;
      f.player.pitch = i >= 310 && i < 400 ? -0.35 : i >= 400 && i < 500 ? -0.06 : 0;
      f.player.sprinting = i >= 1010 && i < 1050;
      spear.adsHeld = (i >= 160 && i < 200) || (i >= 240 && i < 290) || (i >= 320 && i < 330) || (i >= 420 && i < 470) || (i >= 520 && i < 560) || (i >= 690 && i < 730) || (i >= 1070 && i < 1075);
      spear.holster = i >= 1140 ? Math.min(1, (i - 1140) / 30) : 0;
      spear.inspect = i >= 1080 && i < 1100 ? 1 : 0;
      spear.mount = i >= 580 && i < 800 ? { speed: i < 690 ? 9 : 6, yaw: 0 } : null;
      if (i >= 600 && i < 680) runner.position.set(-0.6, 0, -9 + (i - 600) * 0.11);
      if (i === 600) runner.hidden = false;
      if (i === 680) runner.hidden = true;
      if (i === 640) spear.addBolts(2);
      if (i === 1068) spear.javelins = 0;
      if (i === 1090) spear.addBolts(5);
      if (i >= 820 && i < 1000) f.player.position.set(Math.sin((i - 820) / 30) * 3.5, 0, -((i - 820) / 180) * 11.5);
      if (i === 1000) { f.player.position.set(0, 0, 0); cam.aspect = 0.46; cam.updateProjectionMatrix(); }
      if ((i >= 20 && i < 140 && i % 15 === 0) || i === 26) spear.tryFire();
      if (i >= 1010 && i < 1060 && i % 20 === 0) spear.tryFire();
      spear.update(dt, t);
      const scene: unknown[] = [];
      for (const o of game.scene.children) if (o.visible && o !== cam) scene.push(objectRow(o));
      const world = game.scene.children.find((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh);
      const javs: number[][] = [];
      if (world) for (let k = 0; k < world.count; k++) { const m = new THREE.Matrix4(); world.getMatrixAt(k, m); javs.push(m.toArray().map(round)); }
      for (const point of landed) {
        // the impact is where it struck the range, out where it was thrown, and the javelin stuck or lying there sits by it
        // (its balance point 0.58 m back along the flight): the pre-fix spear reported its flight direction and put it
        // 0.42 m from the world origin
        expect(offRange(point), `frame ${i}: impact on the range`).toBeLessThan(0.35);
        expect(point.distanceTo(f.player.position), `frame ${i}: impact out where it was thrown`).toBeGreaterThan(2);
        const nearest = Math.min(...javs.map((m) => Math.hypot((m[12] ?? 0) - point.x, (m[13] ?? 0) - point.y, (m[14] ?? 0) - point.z)));
        expect(nearest, `frame ${i}: javelin at its impact ${v3(point).join(',')}`).toBeLessThan(1);
        stuckChecks++;
      }
      landed.length = 0;
      frames.push({
        i, state: { ...spear.state }, javelins: spear.javelins, out: spear.javelinsOut, winding: spear.winding, thrusting: spear.thrusting,
        fov: round(cam.fov), moveScale: round(f.player.moveScale), swinging: f.player.swinging,
        aim: spear.aimInfo === null ? null : [spear.aimInfo.kind, round(spear.aimInfo.distance)], hp: all.map((a) => [a.alive ? 1 : 0, round(a.hp)]),
        model: [...v3(spear.model.position), ...q4(spear.model.quaternion), spear.model.visible ? 1 : 0],
        parts: spear.model.children.map(objectRow),
        scene, javs,
      });
    }
    const windows: string[] = [];
    for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
    expect({ built, events: digest(JSON.stringify(events)), eventCount: events.length, segments: spear.segments, magazine: spear.magazine,
      clock: round(spear.clock), last: frames.at(-1), windows }).toMatchSnapshot();
    expect(stuckChecks).toBeGreaterThanOrEqual(3);
    const kinds = events.map((e) => Array.isArray(e) ? `${String(e[0])}:${e.length > 1 ? String(e[1]) : ''}` : '');
    for (const want of ['throw:2', 'impact:wood', 'impact:ground', 'impact:flesh', 'hit:wolf', 'hit:boar', 'hit:saiga', 'dry:', 'pickup:2', 'pickup:3']) expect(kinds, want).toContain(want);
  });
});
