import * as THREE from 'three';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import type { Scope } from '@wildshard/engine/app/scope';
import { onSurfaceReflect } from '@wildshard/engine/world/water/view';
import type { Game } from '@wildshard/engine/core/Game';
import { POND, waterLevel } from '@wildshard/engine/world/Heightfield';
import { WATER_LOOKS, type WaterLook } from '../data/waterLook';

/**
 * Pine Hollow's water looks at run time (the graphs: ../../data/waterLook.ts): the compiled pond / creek / trickle / puddle
 * materials, their lent ripple texture and the pond's skyline probe, and the live params the graphs read (each body's
 * fade, the rain's rings, the Explorer map's top-down shot).
 */

/** the rain on the water (world/weather.ts): 0 … 1 rings on every water surface (pond, creek, puddles) */
export const waterWeather = { uRainRings: { value: 0 } };

interface Compiled {
  readonly materials: ReadonlyMap<string, THREE.Material>;
  readonly setParam: (id: string, name: string, value: GraphLiteral) => void;
  readonly setTexture: (id: string, name: string, texture: THREE.Texture) => void;
}
let looks: Compiled | null = null;
const isTexture = (v: unknown): v is THREE.Texture => v instanceof THREE.Texture;
const fades = new Map<string, { value: number }>();

/**
 * Lend the compiled water looks (`runtimeLookMaterials` over WATER_LOOKS), then the pond the session built
 * (engine/world/pond.ts: the mesh `pond` in the root scene, its skyline probe in userData) wears the pond look, its old material's
 * ripple map lent to every look (else one is built). The map's top-down shot follows `surfaceReflect` while `scope` lives.
 */
export function lendPineWater(compiled: Compiled, scope: Scope, game: Pick<Game, 'rootScene'>): void {
  looks = compiled; fades.clear();
  const mesh = game.rootScene.getObjectByName('pond'), old: unknown = mesh instanceof THREE.Mesh ? mesh.material : null;
  const map: unknown = old instanceof THREE.MeshPhysicalMaterial ? old.normalMap : null;
  const ripples = map instanceof THREE.DataTexture ? map : scope.own(rippleTexture());
  for (const id of Object.values(WATER_LOOKS)) compiled.setTexture(id, 'ripples', ripples);
  scope.onDispose(onSurfaceReflect((view) => { for (const id of Object.values(WATER_LOOKS)) compiled.setParam(id, 'topDown', view === 'top-down' ? 1 : 0); }));
  if (!(mesh instanceof THREE.Mesh)) return;
  const skyline: unknown = mesh.userData['waterSkyline'];
  if (!isTexture(skyline)) throw new Error('[pine-hollow] the pond has no skyline probe');
  compiled.setTexture(WATER_LOOKS.pond, 'skyline', skyline);
  compiled.setParam(WATER_LOOKS.pond, 'skyC', [POND.x, POND.z, waterLevel(), 1]);
  mesh.material = pineWater('pond');
  if (old instanceof THREE.Material) old.dispose();
}

/** a water look's material; `fade` (× its alpha) follows the holder once a frame (`syncPineWater`). Throws before the lend. */
export function pineWater(look: WaterLook, fade?: { value: number }): THREE.Material {
  const id = WATER_LOOKS[look], m = looks?.materials.get(id);
  if (m === undefined) throw new Error(`[pine-hollow] no compiled water look ${id}`);
  if (fade !== undefined) fades.set(id, fade);
  return m;
}

/** once a frame: each fading body's alpha and the rain's rings */
export function syncPineWater(): void {
  if (looks === null) return;
  for (const [id, fade] of fades) looks.setParam(id, 'fade', fade.value);
  for (const id of Object.values(WATER_LOOKS)) looks.setParam(id, 'rain', waterWeather.uRainRings.value);
}

/**
 * The tiling ripple texture: RGB a tangent-space normal from a periodic fbm height field (value noise on integer lattices,
 * so it tiles), A a separate bubbly noise for the foam. 256², mipmapped; built once per lend (~20 ms).
 */
function rippleTexture(): THREE.DataTexture {
  const N = 256;
  const lattice = (seed: number, n: number): Float32Array => {
    const a = new Float32Array(n * n);
    let s = seed >>> 0;
    for (let i = 0; i < a.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s / 4294967296; }
    return a;
  };
  /** periodic value noise: `n` cells across the tile, smoothstep-interpolated */
  const vnoise = (L: Float32Array, n: number, u: number, v: number): number => {
    const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = L[y0 * n + x0] ?? 0, b = L[y0 * n + x1] ?? 0, c = L[y1 * n + x0] ?? 0, d = L[y1 * n + x1] ?? 0;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const oct = [4, 8, 16, 32, 64].map((n, i) => ({ n, L: lattice(0x51f + i * 7919, n), w: 0.55 ** i }));
  const foamOct = [8, 16, 32, 64].map((n, i) => ({ n, L: lattice(0xf0a + i * 104729, n), w: 0.6 ** i }));
  const H = new Float32Array(N * N), Fm = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let h = 0, f = 0;
    for (const o of oct) h += vnoise(o.L, o.n, u, v) * o.w;
    for (const o of foamOct) f += vnoise(o.L, o.n, u + 0.13, v + 0.29) * o.w;
    H[y * N + x] = h; Fm[y * N + x] = f;
  }
  // the foam: sharpen the fbm into bubbly clumps and stretch it to 0..1
  let fmin = Infinity, fmax = -Infinity;
  for (const f of Fm) { fmin = Math.min(fmin, f); fmax = Math.max(fmax, f); }
  const data = new Uint8Array(N * N * 4);
  const at = (xx: number, yy: number): number => H[((yy + N) % N) * N + ((xx + N) % N)] ?? 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 9, dy = (at(x, y + 1) - at(x, y - 1)) * 9, l = Math.hypot(dx, dy, 1);
    const i = (y * N + x) * 4;
    data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); data[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
    const f = ((Fm[y * N + x] ?? 0) - fmin) / Math.max(1e-6, fmax - fmin);
    data[i + 3] = Math.round(Math.min(1, Math.max(0, f)) ** 1.4 * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
