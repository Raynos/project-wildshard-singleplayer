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
import { setSetting } from '../../src/engine/ui/Settings';
import { CROSSBOW } from '../../src/shards/pine-hollow/weapons/equipment';
import { Crossbow } from '../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { fakeWorld } from '../fake/world';
import { legacyDouble } from '../fake/FakeGame';

/**
 * SHARD-PLATFORM SF36: Pine Hollow's crossbow as a row over the platform's bolt crossbow. The trace was pinned from the
 * pre-SF36 `class Crossbow extends Weapon` (HEAD f4c2eadd0) and must stay equal: twenty scripted seconds of idle, hip and
 * sighted loosing, dry pulls and reloads, sprint, portrait and holster, with the bolts flying into a real Rapier world
 * (sticking in a wood wall, glancing off a stone wall onto the ground and lying there, riding a moving plank, hitting an
 * animal and a practice dummy's bone), recording the viewmodel's every part, the string, the peep, the hands, every
 * flying and stuck bolt's transform and material, the tracers and markers, the hits, impacts and damage, the camera's
 * FOV and kick, the quiver state and the built geometry and materials.
 */
const round = (n: number): number => Math.round(n * 1e9) / 1e9;
/** FNV-1a over a window's JSON: a locatable digest without a Node module. */
function digest(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.codePointAt(i) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const v3 = (v: THREE.Vector3 | THREE.Euler): number[] => [round(v.x), round(v.y), round(v.z)];
const q4 = (q: THREE.Quaternion): number[] => [round(q.x), round(q.y), round(q.z), round(q.w)];
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
function geometrySum(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  let sum = 0;
  for (let i = 0; i < position.count; i++) sum += position.getX(i) + position.getY(i) * 3 + position.getZ(i) * 7;
  return round(sum);
}
function materialRow(material: THREE.Material | THREE.Material[]): unknown {
  return (Array.isArray(material) ? material : [material]).map((m) => ({ name: m.name, type: m.type, transparent: m.transparent, depthWrite: m.depthWrite,
    opacity: round(m.opacity), blending: m.blending, color: m instanceof THREE.MeshBasicMaterial || m instanceof THREE.MeshStandardMaterial ? m.color.getHexString() : null }));
}
function objectRow(o: THREE.Object3D): unknown {
  const row: unknown[] = [o.type, o.visible ? 1 : 0, ...v3(o.position), ...q4(o.quaternion), round(o.scale.x), round(o.scale.y), o.renderOrder];
  if (isMesh(o)) row.push(materialRow(o.material));
  if (isMesh(o) && o.geometry instanceof THREE.InstancedBufferGeometry) row.push(o.geometry.instanceCount);
  if (o.children.length > 0) row.push(o.children.map(objectRow));
  return row;
}

let R: Awaited<ReturnType<typeof loadRapier>>;
const previousPhysics = activePhysics();
let ph: Physics | null = null;
beforeAll(async () => { R = await loadRapier(readFileSync(createRequire(import.meta.url).resolve('@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm'))); });
afterAll(() => { setActivePhysics(previousPhysics); });

// happy-dom has no 2D raster backend: the procedural textures run against a pixel-buffer canvas port.
beforeEach(() => {
  app.rng.seed(11); setActivePhysics(null); setSetting('tracers', true);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    let pixels: ImageData = { data: new Uint8ClampedArray(0), width: 0, height: 0, colorSpace: 'srgb' };
    const context: Partial<CanvasRenderingContext2D> = {
      createImageData: (input: number | ImageData, requestedHeight?: number) => {
        const width = typeof input === 'number' ? input : input.width;
        const height = typeof input === 'number' ? requestedHeight : input.height;
        if (height === undefined) throw new Error('Canvas height missing');
        return { data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: 'srgb' };
      },
      putImageData: (data) => { pixels = data; }, getImageData: () => pixels,
      strokeStyle: '', fillStyle: '', lineWidth: 1, beginPath: () => undefined, moveTo: () => undefined,
      lineTo: () => undefined, arc: () => undefined, stroke: () => undefined, fill: () => undefined,
      clearRect: () => undefined, fillRect: () => undefined, closePath: () => undefined, quadraticCurveTo: () => undefined,
      save: () => undefined, restore: () => undefined, rotate: () => undefined, translate: () => undefined,
      createLinearGradient: () => legacyDouble<CanvasGradient>({ addColorStop: () => undefined }),
      createRadialGradient: () => legacyDouble<CanvasGradient>({ addColorStop: () => undefined }),
    };
    return legacyDouble<CanvasRenderingContext2D>(context);
  });
});
afterEach(() => { setActivePhysics(null); ph?.dispose(); ph = null; setSetting('tracers', false); vi.restoreAllMocks(); });

/** The range: a wood wall left and a stone wall right 30 m out, the ground under them, a moving plank and a dummy. */
function range(boat: THREE.Object3D): Physics {
  const p = new Physics(R);
  const box = (hx: number, hy: number, hz: number, x: number, y: number, z: number, material: Parameters<typeof tagCollider>[1], owner: unknown = null): void => {
    const c = p.world.createCollider(p.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setCollisionGroups(groups('WORLD')));
    tagCollider(c, material, owner);
  };
  box(8, 5, 0.2, -8, 2, -30, 'wood');
  box(8, 5, 0.2, 8, 2, -30, 'stone');
  box(40, 0.5, 40, 0, -0.5, -20, 'ground');
  box(0.4, 0.4, 0.4, 2.2, 1.9, -16, 'planks', { follows: boat });
  p.step();
  return p;
}

describe('the crossbow on the bolt crossbow family keeps its pre-SF36 trace', () => {
  it('builds the same viewmodel and plays the same scripted twenty seconds of bolts', () => {
    const boat = new THREE.Group(); boat.name = 'boat';
    const bone = new THREE.Group(); bone.name = 'dummy-bone'; bone.position.set(-1, 1.5, -12);
    ph = range(boat); setActivePhysics(ph);
    const f = fakeWorld(), game = f.game.asGame();
    game.scene.add(boat, bone);
    const events: unknown[] = [];
    const dummy = (kind: string, centre: THREE.Vector3, frame: THREE.Object3D | null) => legacyDouble<TargetHit['animal']>({
      kind, alive: true,
      damageFor: (headshot: boolean, distance: number) => (headshot ? 80 : 40) + round(distance),
      applyDamage: (amount: number, point: THREE.Vector3, dir: THREE.Vector3) => { events.push(['damage', kind, round(amount), ...v3(point), ...v3(dir)]); return kind === 'deer'; },
      stuckFrame: () => frame, position: centre,
    });
    const animals = [
      { centre: new THREE.Vector3(-1, 1.5, -12), radius: 0.45, animal: dummy('dummy', new THREE.Vector3(-1, 1.5, -12), bone) },
      { centre: new THREE.Vector3(5.5, 1.8, -20), radius: 0.5, animal: dummy('deer', new THREE.Vector3(5.5, 1.8, -20), null) },
    ];
    const sphere = new THREE.Sphere(), ray = new THREE.Ray(), at = new THREE.Vector3();
    const raycast = (origin: THREE.Vector3, dir: THREE.Vector3, max: number): TargetHit | null => {
      let best: TargetHit | null = null;
      ray.set(origin, dir);
      for (const a of animals) {
        sphere.set(a.centre, a.radius);
        if (ray.intersectSphere(sphere, at) === null) continue;
        const distance = at.distanceTo(origin);
        if (distance <= max && (best === null || distance < best.distance)) best = { animal: a.animal, point: at.clone(), distance, headshot: at.y > a.centre.y + 0.2 };
      }
      return best;
    };
    const crossbow = new Crossbow({ ...f, game }, { raycast }, { row: CROSSBOW, allowUnlocked: true });
    crossbow.onFire = () => { events.push(['fire']); };
    crossbow.onHit = (kind, headshot, killed) => { events.push(['hit', kind, headshot, killed]); };
    crossbow.onImpact = (surface, point) => { events.push(['impact', surface, ...v3(point)]); };
    crossbow.onReloadStart = () => { events.push(['reloadStart']); };
    crossbow.onReloadEnd = () => { events.push(['reloadEnd']); };
    crossbow.onDry = () => { events.push(['dry']); };
    const cam = game.camera;
    const built = { children: crossbow.model.children.length, meshes: [] as unknown[] };
    crossbow.model.traverse((o) => { if (isMesh(o)) built.meshes.push({ geo: geometrySum(o.geometry), verts: o.geometry.getAttribute('position').count, order: o.renderOrder, mat: materialRow(o.material) }); });
    const pitchMaterial = crossbow.boltMaterial.clone(); pitchMaterial.name = 'pitch-bolt';
    const pitch = { gravity: 1.4, drag: 2, damage: (kind: string) => kind === 'deer' ? 1.5 : 0.5, material: pitchMaterial };
    const frames: unknown[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 1200; i++) {
      const t = i * dt;
      f.player.bobTime = t * 9; f.player.speedFactor = i < 300 ? 0.5 : 0;
      f.player.yaw = Math.sin(t * 0.9) * 0.28; f.player.pitch += i % 50 === 0 ? 0.004 : 0;
      f.player.sprinting = i >= 760 && i < 820;
      crossbow.adsHeld = (i >= 90 && i < 260) || (i >= 600 && i < 700);
      crossbow.holster = i >= 1140 ? Math.min(1, (i - 1140) / 30) : 0;
      if (i === 420) { cam.aspect = 0.46; cam.updateProjectionMatrix(); }
      if (i === 500) crossbow.boltMod = pitch;
      if (i === 880) crossbow.boltMod = { gravity: 1, drag: 1, damage: () => 1 };
      if (i === 900) { setSetting('tracers', false); crossbow.reloadScale = 0.5; }
      if (i === 960) crossbow.addBolts(3);
      if (i >= 20 && i < 1100 && i % 20 === 0) crossbow.tryFire();
      if (i === 1010) crossbow.reload();
      crossbow.update(dt, t);
      boat.position.x = Math.sin(t) * 0.2;
      const scene: unknown[] = [];
      for (const o of game.scene.children) if (o.visible && o !== cam) scene.push(objectRow(o));
      frames.push({
        i, state: { ...crossbow.state, reloadProgress: round(crossbow.state.reloadProgress) }, fov: round(cam.fov), pitch: round(f.player.pitch),
        inFlight: crossbow.inFlight, stuck: crossbow.stuckCount, aim: crossbow.aimInfo === null ? null : [crossbow.aimInfo.kind, round(crossbow.aimInfo.distance)],
        model: [...v3(crossbow.model.position), ...v3(crossbow.model.rotation), round(crossbow.model.scale.x)],
        parts: crossbow.model.children.map(objectRow),
        scene, boat: boat.children.map(objectRow), bone: bone.children.map(objectRow),
      });
    }
    // Every frame is in the digest; a window of 30 frames per digest keeps a mismatch locatable and the snapshot small.
    const windows: string[] = [];
    for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
    const adsPose = Object.fromEntries(Object.entries(crossbow.adsPose).map(([k, v]) => [k, round(v)]));
    expect({ built, events, adsPose, handsCost: crossbow.handsCost, last: frames.at(-1), windows }).toMatchSnapshot();
    // the scene the trace walked: bolts loosed, stuck in wood, the plank and the dummy, glanced and lay, hit the deer
    const kinds = events.map((e) => Array.isArray(e) ? `${String(e[0])}:${e.length > 1 ? String(e[1]) : ''}` : '');
    expect(kinds.filter((k) => k === 'fire:').length).toBe(10);
    for (const want of ['impact:wood', 'impact:ground', 'hit:dummy', 'hit:deer', 'impact:flesh', 'dry:']) expect(kinds, want).toContain(want);
    expect([boat.children.length, bone.children.length]).toEqual([1, 1]);
  });
});
