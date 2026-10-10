// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import type { TargetHit } from '../../src/engine/combat/types';
import { setActivePhysics } from '../../src/engine/physics/active';
import { setAimTargets } from '../../src/engine/player/AimTargets';
import { Bow } from '../../src/game/weapons/Bow';
import { GoldenBow, GoldenBowPower } from '../../src/shards/nalati-grasslands/runtime/weapons/GoldenBow';
import { BOW } from '../../src/shards/nalati-grasslands/weapons/equipment';
import { NALATI_BOW } from '../../src/shards/nalati-grasslands/weapons/loadout';
import { fakeWorld } from '../fake/world';
import { digest, isMesh, geometrySum, materialRow, objectRow, mockCanvas, q4, round, v3 } from '../fake/weaponParity';

/**
 * SHARD-PLATFORM SF36: the Golden Bow as a row over the platform's reward bow. The trace was pinned from the pre-SF36
 * `class GoldenBow extends Bow` (HEAD 275bb16b2) and must stay equal: a plain bow with a damage multiplier, a loose hook
 * and a saddle replaced by the Golden Bow, then twenty scripted seconds of full draws (sun arrows, their streak and the
 * pierce through to a second creature and a balbal), short draws, the saddle (rear shots), the aim zoom, portrait and
 * holster, recording the viewmodel's every part, the scene (arrows, streak), the hits and damage, the draw, the carrier
 * velocity and the built geometry and materials.
 */
beforeEach(() => { app.rng.seed(11); setActivePhysics(null); setAimTargets([]); mockCanvas(); });
afterEach(() => { setActivePhysics(null); setAimTargets([]); vi.restoreAllMocks(); });

interface Dummy {
  kind: string; alive: boolean; position: THREE.Vector3; radius: number; hp: number;
  applyDamage: (amount: number, point: THREE.Vector3, dir: THREE.Vector3) => boolean;
  damageFor: (headshot: boolean, distance: number) => number;
}

describe('the Golden Bow on the reward bow family keeps its pre-SF36 trace', () => {
  it('replaces a bow the same way and plays the same scripted twenty seconds', () => {
    const f = fakeWorld(), game = f.game.asGame();
    Reflect.set(f.player, 'swimming', false); Reflect.set(f.player, 'dashCd', 0);
    const events: unknown[] = [];
    const dummy = (kind: string, x: number, y: number, z: number, hp: number): Dummy => {
      const d: Dummy = {
        kind, alive: true, position: new THREE.Vector3(x, y, z), radius: 0.7, hp,
        applyDamage: (amount, point, dir) => {
          d.hp -= amount; events.push(['damage', kind, round(amount), ...v3(point), ...v3(dir), round(d.hp)]);
          if (d.hp <= 0) { d.alive = false; return true; }
          return false;
        },
        damageFor: (headshot, distance) => (headshot ? 70 : 35) + round(distance),
      };
      return d;
    };
    const near = dummy('wolf', 0.1, 1.5, -12, 260), far = dummy('boar', 0.15, 0.4, -19, 400), stone = dummy('balbal', 0.2, 0.2, -27, 900);
    far.radius = 1.3; stone.radius = 1.4; // tall enough for the camera's line (the power walks it) and the eye's
    const all = [near, far, stone];
    const sphere = new THREE.Sphere(), ray = new THREE.Ray(), at = new THREE.Vector3();
    const nearest = (origin: THREE.Vector3, dir: THREE.Vector3, max: number): { a: Dummy; point: THREE.Vector3; distance: number } | null => {
      let best: { a: Dummy; point: THREE.Vector3; distance: number } | null = null;
      ray.set(origin, dir);
      for (const a of all) {
        if (!a.alive) continue;
        sphere.set(a.position, a.radius);
        if (ray.intersectSphere(sphere, at) === null) continue;
        const distance = at.distanceTo(origin);
        if (distance <= max && (best === null || distance < best.distance)) best = { a, point: at.clone(), distance };
      }
      return best;
    };
    const raycast = (origin: THREE.Vector3, dir: THREE.Vector3, max: number): TargetHit | null => {
      const hit = nearest(origin, dir, max);
      return hit === null ? null : { animal: hit.a, point: hit.point, distance: hit.distance, headshot: hit.point.y > hit.a.position.y + 0.3 };
    };
    const world = { game, sky: f.sky, player: f.player, forest: f.forest };
    const previous = new Bow(world, { raycast }, { row: BOW, profile: NALATI_BOW, allowUnlocked: true });
    previous.damageMultiplier = (hit) => hit.animal.kind === 'boar' ? 1.5 : 1;
    previous.onLoose = (p) => { events.push(['previous-loose', round(p)]); };
    previous.setMount({ speed: 9, yaw: 0.3 });
    const power = new GoldenBowPower({ scene: game.scene, sky: f.sky, camera: game.camera,
      raycast: (origin, dir, max) => {
        const hit = nearest(origin, dir, max);
        return hit === null ? null : { animal: hit.a, point: hit.point, distance: hit.distance, headshot: false, damage: hit.a.damageFor(false, hit.distance) };
      } });
    const bow = new GoldenBow(world, { raycast }, { row: BOW, profile: NALATI_BOW, allowUnlocked: true, power, previous });
    bow.wind = null;
    bow.onFire = () => { events.push(['fire']); };
    bow.onHit = (kind, headshot, killed) => { events.push(['hit', kind, headshot, killed]); };
    bow.onImpact = (surface, point) => { events.push(['impact', surface, ...v3(point)]); };
    bow.onFullDraw = () => { events.push(['full']); };
    const cam = game.camera;
    const built = { children: bow.model.children.length, row: [bow.row.id, bow.meta.name, bow.style], drawSpeedScale: round(bow.drawSpeedScale),
      carrier: v3(bow.carrierVelocity), meshes: [] as unknown[] };
    bow.model.traverse((o) => { if (isMesh(o)) built.meshes.push({ geo: geometrySum(o.geometry), verts: o.geometry.getAttribute('position').count, order: o.renderOrder, mat: materialRow(o.material) }); });
    const frames: unknown[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 1200; i++) {
      const t = i * dt;
      f.player.bobTime = t * 9; f.player.speedFactor = i < 300 ? 0.5 : 0;
      f.player.yaw = i >= 560 && i < 640 ? 2.4 : Math.sin(t * 0.6) * 0.012; f.player.pitch = Math.sin(t * 0.4) * 0.01;
      bow.altHeld = (i >= 20 && i < 90) || (i >= 150 && i < 165) || (i >= 230 && i < 300) || (i >= 380 && i < 460) || (i >= 560 && i < 610)
        || (i >= 700 && i < 790) || (i >= 900 && i < 980);
      bow.adsHeld = i >= 880 && i < 1000;
      bow.holster = i >= 1140 ? Math.min(1, (i - 1140) / 30) : 0;
      if (i === 0) bow.setMount(null);
      if (i === 340) bow.setMount({ speed: 11, yaw: 0.05 });
      if (i === 660) bow.setMount(null);
      if (i === 820) { cam.aspect = 0.46; cam.updateProjectionMatrix(); }
      if (i === 1050) bow.tryFire();
      bow.update(dt, t);
      power.update(dt);
      const scene: unknown[] = [];
      for (const o of game.scene.children) if (o.visible && o !== cam) scene.push(objectRow(o));
      frames.push({
        i, state: { ...bow.state }, charge: round(bow.charge), full: bow.fullDraw, aimed: bow.aimed, fov: round(cam.fov),
        carrier: v3(bow.carrierVelocity), hp: all.map((a) => [a.alive ? 1 : 0, round(a.hp)]),
        model: [...v3(bow.model.position), ...q4(bow.model.quaternion), round(bow.model.scale.x), bow.model.visible ? 1 : 0],
        parts: bow.model.children.map(objectRow),
        scene,
      });
    }
    const windows: string[] = [];
    for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
    expect({ built, events: digest(JSON.stringify(events)), eventCount: events.length, last: frames.at(-1), windows }).toMatchSnapshot();
    // the trace walked the scene it claims: arrows loosed, the first creature hit, the sun arrow's pierce reaching another
    const kinds = events.map((e) => Array.isArray(e) ? `${String(e[0])}:${e.length > 1 ? String(e[1]) : ''}` : '');
    expect(kinds.filter((k) => k === 'fire:').length).toBeGreaterThanOrEqual(6);
    for (const want of ['hit:wolf', 'damage:balbal', 'full:']) expect(kinds, want).toContain(want);
    expect(kinds).not.toContain('previous-loose:');
  });
});
