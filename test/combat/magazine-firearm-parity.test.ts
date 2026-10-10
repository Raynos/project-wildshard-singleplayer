// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { setActivePhysics } from '../../src/engine/physics/active';
import { setSetting } from '../../src/engine/ui/Settings';
import { AR15 } from '../../src/shards/nalati-grasslands/weapons/equipment';
import { Rifle } from '../../src/shards/nalati-grasslands/runtime/weapons/Rifle';
import { fakeWorld } from '../fake/world';
import { legacyDouble } from '../fake/FakeGame';

/**
 * SHARD-PLATFORM SF36: the AR-15 as a row over the platform's magazine firearm. The trace was pinned from the
 * pre-SF36 `class Rifle extends Firearm` (HEAD a6a86b73d) and must stay equal: a scripted minute of idle, hip and
 * sighted fire, a dry magazine's auto reload, sprint, portrait and holster, recording the viewmodel's every part, the
 * flash and its light, the brass, the camera's FOV and kick, the weapon state and the built geometry and materials.
 */
const round = (n: number): number => Math.round(n * 1e9) / 1e9;
/** FNV-1a over a window's JSON: a locatable digest without a Node module. */
function digest(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.codePointAt(i) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const v3 = (v: THREE.Vector3 | THREE.Euler): number[] => [round(v.x), round(v.y), round(v.z)];
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
afterEach(() => { setActivePhysics(null); setSetting('tracers', false); vi.restoreAllMocks(); });

describe('the AR-15 on the magazine firearm family keeps its pre-SF36 trace', () => {
  it('builds the same viewmodel and plays the same scripted minute', () => {
    const f = fakeWorld(), game = f.game.asGame();
    const rifle = new Rifle({ ...f, game }, { raycast: () => null }, { row: AR15, allowUnlocked: true, muzzleLight: false });
    const cam = game.camera;
    const built = { children: rifle.model.children.length, meshes: [] as unknown[] };
    rifle.model.traverse((o) => { if (isMesh(o)) built.meshes.push({ geo: geometrySum(o.geometry), verts: o.geometry.getAttribute('position').count, order: o.renderOrder, mat: materialRow(o.material) }); });
    const display = rifle.displayModel().children.filter(isMesh).map((m) => [geometrySum(m.geometry)].concat(v3(m.position)));
    const frames: unknown[] = [];
    const dt = 1 / 60;
    for (let i = 0; i < 600; i++) {
      const t = i * dt;
      f.player.bobTime = t * 9; f.player.speedFactor = i < 200 ? 0.5 : 0;
      f.player.yaw = Math.sin(t * 1.3) * 0.4; f.player.pitch += i % 50 === 0 ? 0.02 : 0;
      f.player.sprinting = i >= 420 && i < 470;
      rifle.adsHeld = i >= 60 && i < 160;
      rifle.holster = i >= 540 ? Math.min(1, (i - 540) / 30) : 0;
      if (i === 300) { cam.aspect = 0.46; cam.updateProjectionMatrix(); }
      if ((i >= 20 && i < 400 && i % 6 === 0) || i === 500) rifle.tryFire();
      if (i === 480) rifle.reload();
      rifle.update(dt, t);
      const scene: number[][] = [];
      for (const o of game.scene.children) if (o.visible && isMesh(o)) scene.push([...v3(o.position), ...v3(o.rotation)]);
      frames.push({
        i, state: { ...rifle.state, reloadProgress: round(rifle.state.reloadProgress) }, fov: round(cam.fov), pitch: round(f.player.pitch),
        model: [...v3(rifle.model.position), ...v3(rifle.model.rotation), round(rifle.model.scale.x)],
        parts: rifle.model.children.map((c) => [c.visible ? 1 : 0].concat(v3(c.position), v3(c.rotation), [round(c.scale.x)])),
        scene,
      });
    }
    // Every frame is in the digest; a window of 30 frames per digest keeps a mismatch locatable and the snapshot small.
    const windows: string[] = [];
    for (let w = 0; w < frames.length; w += 30) windows.push(digest(JSON.stringify(frames.slice(w, w + 30))));
    expect({ built, display, last: frames.at(-1), windows }).toMatchSnapshot();
  });
});
