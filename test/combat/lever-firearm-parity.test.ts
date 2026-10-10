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
import { LEVER } from '../../src/shards/pine-hollow/weapons/equipment';
import { LeverRifle } from '../../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { fakeWorld } from '../fake/world';
import { legacyDouble } from '../fake/FakeGame';

/**
 * SHARD-PLATFORM SF36: Pine Hollow's lever-action as a row over the platform's lever firearm. The trace was pinned from the
 * pre-SF36 `class LeverRifle extends Firearm` (HEAD 4361fd79b) and must stay equal: twenty scripted seconds of idle, hip
 * and sighted fire with the lever cycling between shots, a run-dry auto reload and a manual reload through the gate (one
 * round at a time, a trigger pull mid-reload stopping it), a frozen cycle, sprint, portrait, inspection, a holster and a
 * deactivation, shooting into a real Rapier range and two animals, recording the viewmodel's every part (lever, hammer,
 * bolt, the cartridge in hand, the flash, the hands), the brass and tracers in the scene, the hits, impacts and sounds,
 * FOV, kick, the action and HUD state, the built geometry and materials and the pickup display model.
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


/** The range: a wood wall left and a stone wall right 30 m out and the ground under them. */
function range(): Physics {
  const p = new Physics(R);
  const box = (hx: number, hy: number, hz: number, x: number, y: number, z: number, material: Parameters<typeof tagCollider>[1]): void => {
    const c = p.world.createCollider(p.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setCollisionGroups(groups('WORLD')));
    tagCollider(c, material);
  };
  box(8, 5, 0.2, -8, 2, -30, 'wood');
  box(8, 5, 0.2, 8, 2, -30, 'stone');
  box(40, 0.5, 40, 0, -0.5, -20, 'ground');
  p.step();
  return p;
}

describe('the lever-action on the lever firearm family keeps its pre-SF36 trace', () => {
  it('builds the same viewmodel and plays the same scripted twenty seconds', () => {
    ph = range(); setActivePhysics(ph);
    const f = fakeWorld(), game = f.game.asGame();
    const events: unknown[] = [];
    const dummy = (kind: string, centre: THREE.Vector3) => legacyDouble<TargetHit['animal']>({
      kind, alive: true, position: centre,
      damageFor: (headshot: boolean, distance: number) => (headshot ? 80 : 40) + round(distance),
      applyDamage: (amount: number, point: THREE.Vector3, dir: THREE.Vector3) => { events.push(['damage', kind, round(amount), ...v3(point), ...v3(dir)]); return kind === 'deer'; },
    });
    const animals = [
      { centre: new THREE.Vector3(-1.2, 1.6, -12), radius: 0.6, animal: dummy('boar', new THREE.Vector3(-1.2, 1.6, -12)) },
      { centre: new THREE.Vector3(3, 1.7, -20), radius: 0.8, animal: dummy('deer', new THREE.Vector3(3, 1.7, -20)) },
    ];
    const sphere = new THREE.Sphere(), ray = new THREE.Ray(), at = new THREE.Vector3();
    const raycast = (origin: THREE.Vector3, dir: THREE.Vector3, max: number): TargetHit | null => {
      let best: TargetHit | null = null;
      ray.set(origin, dir);
      for (const a of animals) {
        sphere.set(a.centre, a.radius);
        if (ray.intersectSphere(sphere, at) === null) continue;
        const distance = at.distanceTo(origin);
        if (distance <= max && (best === null || distance < best.distance)) best = { animal: a.animal, point: at.clone(), distance, headshot: at.y > a.centre.y + 0.3 };
      }
      return best;
    };
    const rifle = new LeverRifle({ ...f, game }, { raycast }, { row: LEVER, allowUnlocked: true, muzzleLight: false, model: null });
    rifle.onFire = () => { events.push(['fire']); };
    rifle.onHit = (kind, headshot, killed) => { events.push(['hit', kind, headshot, killed]); };
    rifle.onImpact = (surface, point) => { events.push(['impact', surface, ...v3(point)]); };
    rifle.onReloadStart = () => { events.push(['reloadStart']); };
    rifle.onReloadEnd = () => { events.push(['reloadEnd']); };
    rifle.onDry = () => { events.push(['dry']); };
    rifle.onCycle = () => { events.push(['cycle']); };
    rifle.onRoundIn = () => { events.push(['roundIn']); };
    const cam = game.camera;
    const built = { children: rifle.model.children.length, meshes: [] as unknown[] };
    rifle.model.traverse((o) => { if (isMesh(o)) built.meshes.push({ geo: geometrySum(o.geometry), verts: o.geometry.getAttribute('position').count, order: o.renderOrder, mat: materialRow(o.material) }); });
    const display = rifle.displayModel().children.filter(isMesh).map((m) => [geometrySum(m.geometry), m.layers.mask, m.castShadow ? 1 : 0, materialRow(m.material)]);
    const frames: unknown[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 1200; i++) {
      const t = i * dt;
      f.player.bobTime = t * 9; f.player.speedFactor = i < 300 ? 0.5 : 0;
      f.player.yaw = Math.sin(t * 0.9) * 0.2; f.player.pitch += i % 50 === 0 ? 0.003 : 0;
      f.player.sprinting = i >= 760 && i < 820;
      rifle.adsHeld = (i >= 90 && i < 260) || (i >= 600 && i < 700);
      rifle.holster = i >= 1140 ? Math.min(1, (i - 1140) / 30) : 0;
      rifle.freezeCycle = i >= 330 && i < 350 ? 0.45 : null;
      rifle.inspect = i >= 830 && i < 860 ? 1 : 0;
      if (i === 420) { cam.aspect = 0.46; cam.updateProjectionMatrix(); }
      if (i === 870) rifle.setActive(false);
      if (i === 890) { rifle.setActive(true); rifle.enabled = true; }
      if (i === 900) setSetting('tracers', false);
      if (i === 960) rifle.addRounds(4);
      if (i >= 20 && i < 1100 && i % 15 === 0) rifle.tryFire();
      if (i === 700 || i === 1010) rifle.reload();
      rifle.update(dt, t);
      const scene: unknown[] = [];
      for (const o of game.scene.children) if (o.visible && o !== cam) scene.push(objectRow(o));
      frames.push({
        i, state: { ...rifle.state, reloadProgress: round(rifle.state.reloadProgress) }, action: rifle.action, cycleU: round(rifle.cycleU),
        fov: round(cam.fov), pitch: round(f.player.pitch), aim: rifle.aimInfo === null ? null : [rifle.aimInfo.kind, round(rifle.aimInfo.distance)],
        model: [rifle.model.visible ? 1 : 0, ...v3(rifle.model.position), ...v3(rifle.model.rotation), round(rifle.model.scale.x)],
        parts: rifle.model.children.map(objectRow), scene,
      });
    }
    // Every frame is in the digest; a window of 30 frames per digest keeps a mismatch locatable and the snapshot small.
    const windows: string[] = [];
    for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
    const adsPose = Object.fromEntries(Object.entries(rifle.adsPose).map(([k, v]) => [k, round(v)]));
    expect({ built, display, events, adsPose, handsCost: rifle.handsCost, last: frames.at(-1), windows }).toMatchSnapshot();
    const kinds = events.map((e) => Array.isArray(e) ? `${String(e[0])}:${e.length > 1 ? String(e[1]) : ''}` : '');
    for (const want of ['fire:', 'cycle:', 'roundIn:', 'reloadStart:', 'reloadEnd:', 'impact:wood', 'impact:ground', 'hit:boar', 'hit:deer']) expect(kinds, want).toContain(want);
  });
});
