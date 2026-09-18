import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import { heightAt } from '../world/Heightfield';
import { CHUNK_HALF } from '../core/config';

/**
 * Crossbow — first-person hero weapon: procedural medieval hunting crossbow viewmodel,
 * physical bolt projectiles, impact puffs, ADS zoom, recoil and reload.
 *
 *   const crossbow = new Crossbow({ game, sky, player, forest }, targets?, { allowUnlocked?: boolean });
 *   game.onUpdate((dt, t) => crossbow.update(dt, t));   // register AFTER player.update
 *
 * Input (only while `player.locked`, or always when `allowUnlocked`): LMB / `F` fire, RMB (hold) ADS,
 * `R` reload. `crossbow.enabled = false` mutes input (intro / pause). `crossbow.adsHeld` can be forced.
 *
 * Events (assign callbacks):
 *   onFire()                                       — a bolt left the rail (play crossbowFire, kick crosshair)
 *   onHit(kind, headshot, killed)                  — a bolt hit an animal from `targets`
 *   onImpact(surface: 'wood'|'ground'|'flesh', point) — any bolt impact (play boltImpact)
 *   onReloadStart() / onReloadEnd()
 *   onDry()                                        — trigger pulled with nothing loaded
 * State: `crossbow.state` → { bolts, loaded, reloading, reloadProgress, ads }  (bolts includes the loaded one)
 * `crossbow.aimInfo` → { kind, distance } | null — the animal under the crosshair (for the HUD range readout)
 *
 * Side effects the integrator must know about: ADS tweens `game.camera.fov` (72 → 50) and calls
 * `camera.updateProjectionMatrix()` + `sky.csm.updateFrustums()`; recoil nudges `player.pitch`;
 * the viewmodel is parented to `game.camera` and the camera is added to the scene.
 * Animals are reached only through the `Targets` interface below (no import of the animal module).
 */

export interface TargetAnimal {
  applyDamage(amount: number, point: THREE.Vector3, dir: THREE.Vector3): boolean;
  kind: 'deer' | 'boar';
  position: THREE.Vector3;
  alive: boolean;
}
export interface TargetHit { animal: TargetAnimal; point: THREE.Vector3; distance: number; headshot: boolean }
export interface Targets { raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): TargetHit | null }
export type ImpactSurface = 'wood' | 'ground' | 'flesh';
export interface CrossbowWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface CrossbowOptions { allowUnlocked?: boolean }

export const MAX_BOLTS = 30;
const BOLT_SPEED = 62;
const BOLT_DRAG = 0.012;
const GRAVITY = 9.8;
const RELOAD_DURATION = 1.35;
const AUTO_RELOAD_DELAY = 1.4;
const FIRE_COOLDOWN = 0.3;
const MAX_FLYING = 8;
const MAX_STUCK = 20;
const STUCK_LIFETIME = 30;
const FOV_HIP = 72, FOV_ADS = 50;
/** Vertical FOV to give the camera. Three's fov is vertical, so on a portrait phone a fixed 72° collapses the
 *  horizontal view to ~37°; widen it (Hor+ via the geometric mean of the aspect) so 72° hip → ~94° at 9:19.5. */
function fovForAspect(base: number, aspect: number) {
  if (aspect >= 1) return base;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / Math.sqrt(aspect)));
}
const KICK_PITCH = THREE.MathUtils.degToRad(0.8);
const BODY_DAMAGE = 55, HEAD_DAMAGE = 130;

// ───────────────────────────── procedural noise / textures ─────────────────────────────

function makeNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const n = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
  const fbm = (x: number, y: number, oct = 4) => {
    let s = 0, a = 0.5, f = 1, sum = 0;
    for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; sum += a; a *= 0.5; f *= 2.03; }
    return s / sum;
  };
  return { hash, n, fbm };
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function dataTexture(data: Uint8Array, w: number, h: number, srgb: boolean, repeat = 1): THREE.DataTexture {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function normalFromHeight(h: Float32Array, w: number, hgt: number, strength: number): THREE.DataTexture {
  const out = new Uint8Array(w * hgt * 4);
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const l = h[y * w + ((x + w - 1) % w)], r = h[y * w + ((x + 1) % w)];
    const d = h[((y + hgt - 1) % hgt) * w + x], u = h[((y + 1) % hgt) * w + x];
    let nx = -(r - l) * strength, ny = -(u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return dataTexture(out, w, hgt, false);
}

interface TexSet { map: THREE.Texture; normalMap: THREE.Texture; armMap: THREE.Texture }

/** Dark walnut: fine ring bands, streaks along the grain, oil smudges. Grain runs along U. 1 UV unit ≈ 1 m × 0.25 m. */
function makeWalnut(seed: number): TexSet {
  const W = 1024, H = 256;
  const { fbm, hash } = makeNoise(seed);
  const col = new Uint8Array(W * H * 4), arm = new Uint8Array(W * H * 4), hgt = new Float32Array(W * H);
  const dark = [22, 12, 6], light = [72, 46, 26];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const warp = fbm(u * 3 + 7, v * 2, 4);
    const ringCoord = v * 26 + u * 1.3 + warp * 3.2 + fbm(u * 40, v * 6, 2) * 0.7;
    const ring = ringCoord - Math.floor(ringCoord);
    const band = sstep(0.5, 0.8, ring) * (1 - sstep(0.9, 1.0, ring)); // late wood
    const fine = fbm(u * 160, v * 24 + 3, 3);
    const smudge = fbm(u * 4 + 40, v * 3 + 9, 3);
    const fleck = hash(x, y);
    const lum = (1 - band * 0.55) * (0.72 + fine * 0.5) * (0.82 + smudge * 0.32) * (0.96 + fleck * 0.08);
    const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) col[i + c] = clamp01((dark[c] + (light[c] - dark[c]) * lum) / 255) * 255;
    col[i + 3] = 255;
    const rough = clamp01(0.74 + band * 0.12 + (fine - 0.5) * 0.14 - smudge * 0.08);
    arm[i] = (1 - band * 0.1) * 255; arm[i + 1] = rough * 255; arm[i + 2] = 0; arm[i + 3] = 255;
    hgt[y * W + x] = (1 - band) * 0.45 + fine * 0.3 + fleck * 0.02;
  }
  return { map: dataTexture(col, W, H, true), normalMap: normalFromHeight(hgt, W, H, 1.6), armMap: dataTexture(arm, W, H, false) };
}

/** Forged steel: mottled grey, brushed scratches, pits with a rust tint. */
function makeSteel(seed: number): TexSet {
  const S = 512;
  const { fbm, hash } = makeNoise(seed);
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  const roughBase = new Float32Array(S * S), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const mottle = fbm(u * 6, v * 6, 4), grain = fbm(u * 120, v * 4, 2);
    const g = 128 + (mottle - 0.5) * 50 + (grain - 0.5) * 18;
    const i = (y * S + x) * 4;
    img.data[i] = g * 0.98; img.data[i + 1] = g; img.data[i + 2] = g * 1.04; img.data[i + 3] = 255;
    roughBase[y * S + x] = 0.3 + (mottle - 0.5) * 0.2 + (grain - 0.5) * 0.12;
    hgt[y * S + x] = mottle * 0.3 + grain * 0.15;
  }
  ctx.putImageData(img, 0, 0);
  // scratches (brushed, mostly horizontal) + pits
  const rnd = (i: number) => hash(i, 77);
  for (let k = 0; k < 220; k++) {
    const x0 = rnd(k) * S, y0 = rnd(k + 1000) * S, len = 20 + rnd(k + 2000) * 120, ang = (rnd(k + 3000) - 0.5) * 0.5 + (rnd(k + 4000) > 0.85 ? 1.2 : 0);
    ctx.strokeStyle = `rgba(${200 + rnd(k + 5000) * 55},${205 + rnd(k + 5000) * 50},${215 + rnd(k + 5000) * 40},${0.12 + rnd(k + 6000) * 0.25})`;
    ctx.lineWidth = 0.6 + rnd(k + 7000) * 1.2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len); ctx.stroke();
  }
  for (let k = 0; k < 90; k++) {
    const x0 = rnd(k + 9000) * S, y0 = rnd(k + 9500) * S, r = 1 + rnd(k + 9800) * 3.5;
    ctx.fillStyle = `rgba(${70 + rnd(k) * 40},${45 + rnd(k) * 25},${28},${0.35 + rnd(k + 300) * 0.4})`;
    ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2); ctx.fill();
  }
  const final = ctx.getImageData(0, 0, S, S).data;
  const col = new Uint8Array(S * S * 4), arm = new Uint8Array(S * S * 4);
  for (let p = 0; p < S * S; p++) {
    const i = p * 4;
    col[i] = final[i]; col[i + 1] = final[i + 1]; col[i + 2] = final[i + 2]; col[i + 3] = 255;
    const bright = (final[i] + final[i + 1] + final[i + 2]) / (3 * 128); // scratches are bright, pits dark
    const rusty = final[i] > final[i + 2] + 12 ? 1 : 0;
    const rough = clamp01(roughBase[p] + Math.max(0, bright - 1.05) * 0.5 + rusty * 0.45);
    arm[i] = (1 - rusty * 0.35) * 255; arm[i + 1] = rough * 255; arm[i + 2] = (1 - rusty * 0.6) * 255; arm[i + 3] = 255;
    hgt[p] += (bright - 1) * 0.6 - rusty * 0.8;
  }
  return { map: dataTexture(col, S, S, true), normalMap: normalFromHeight(hgt, S, S, 1.4), armMap: dataTexture(arm, S, S, false) };
}

/** Oiled leather wrap: pebbled grain + strap seams. */
function makeLeather(seed: number): TexSet {
  const S = 256;
  const { fbm } = makeNoise(seed);
  const col = new Uint8Array(S * S * 4), arm = new Uint8Array(S * S * 4), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const pebble = fbm(u * 40, v * 40, 3), big = fbm(u * 4, v * 4, 3);
    const seam = Math.abs(((v * 6) % 1) - 0.5) < 0.04 ? 1 : 0;
    const lum = 0.55 + (pebble - 0.5) * 0.5 + (big - 0.5) * 0.4 - seam * 0.35;
    const i = (y * S + x) * 4;
    col[i] = clamp01(lum * 0.4) * 255; col[i + 1] = clamp01(lum * 0.26) * 255; col[i + 2] = clamp01(lum * 0.16) * 255; col[i + 3] = 255;
    arm[i] = (1 - seam * 0.3) * 255; arm[i + 1] = clamp01(0.62 + (pebble - 0.5) * 0.3 + seam * 0.2) * 255; arm[i + 2] = 0; arm[i + 3] = 255;
    hgt[y * S + x] = pebble * 0.5 - seam * 0.8;
  }
  return { map: dataTexture(col, S, S, true), normalMap: normalFromHeight(hgt, S, S, 2.5), armMap: dataTexture(arm, S, S, false) };
}

/** Twisted hemp cord: diagonal stripes for both colour and bump. */
function makeCord(): { map: THREE.Texture; normalMap: THREE.Texture } {
  const S = 64;
  const { fbm } = makeNoise(5);
  const col = new Uint8Array(S * S * 4), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const twist = Math.sin((u * 2 + v * 6) * Math.PI * 2);
    const f = fbm(u * 8, v * 8, 2);
    const lum = 0.62 + twist * 0.2 + (f - 0.5) * 0.15;
    const i = (y * S + x) * 4;
    col[i] = clamp01(lum * 0.46) * 255; col[i + 1] = clamp01(lum * 0.36) * 255; col[i + 2] = clamp01(lum * 0.22) * 255; col[i + 3] = 255;
    hgt[y * S + x] = twist * 0.5;
  }
  const map = dataTexture(col, S, S, true); map.repeat.set(1, 14);
  const normalMap = normalFromHeight(hgt, S, S, 3); normalMap.repeat.set(1, 14);
  return { map, normalMap };
}

/** Bolt atlas: bottom half ash shaft, top-left steel, top-right feather vane (alpha). */
function makeBoltAtlas(seed: number): TexSet {
  const S = 512;
  const { fbm, hash } = makeNoise(seed);
  const col = new Uint8Array(S * S * 4), arm = new Uint8Array(S * S * 4), hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    let r = 0, g = 0, b = 0, a = 255, rough = 0.6, metal = 0, ao = 1, h = 0;
    if (v < 0.5) { // ash shaft, grain along U
      const grain = fbm(u * 60, v * 10, 3), ring = fbm(u * 3, v * 40, 2);
      const lum = 0.66 + (grain - 0.5) * 0.35 + (ring - 0.5) * 0.2;
      r = 176 * lum; g = 142 * lum; b = 96 * lum; rough = 0.55 + (grain - 0.5) * 0.2; h = grain;
    } else if (u < 0.5) { // steel
      const m = fbm(u * 20, v * 20, 4), scratch = fbm(u * 200, v * 6, 2);
      const lum = 0.5 + (m - 0.5) * 0.35 + (scratch - 0.5) * 0.15;
      r = 255 * lum * 0.97; g = 255 * lum; b = 255 * lum * 1.03; rough = 0.28 + (m - 0.5) * 0.25 + (scratch - 0.5) * 0.2; metal = 1; h = m * 0.5;
    } else { // feather: vane shape centred, barbs
      const lu = (u - 0.5) * 2, lv = (v - 0.5) * 2; // 0..1 each
      const edge = 0.92 - Math.pow(lu, 1.6) * 0.75; // trailing edge profile
      const inside = lv < edge && lv > 0.04 && lu > 0.02 && lu < 0.98;
      const barb = Math.sin((lv * 24 + lu * 8) * Math.PI * 2) * 0.5 + 0.5;
      const stripe = lu > 0.35 && lu < 0.55 ? 0.35 : 1;
      const lum = (0.78 + barb * 0.22 + (hash(x, y) - 0.5) * 0.08) * stripe;
      r = 205 * lum; g = 196 * lum; b = 178 * lum; a = inside ? 255 : 0; rough = 0.75; h = barb * 0.3;
    }
    col[i] = clamp01(r / 255) * 255; col[i + 1] = clamp01(g / 255) * 255; col[i + 2] = clamp01(b / 255) * 255; col[i + 3] = a;
    arm[i] = ao * 255; arm[i + 1] = clamp01(rough) * 255; arm[i + 2] = metal * 255; arm[i + 3] = 255;
    hgt[y * S + x] = h;
  }
  const map = dataTexture(col, S, S, true); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; map.premultiplyAlpha = false;
  return { map, normalMap: normalFromHeight(hgt, S, S, 1.5), armMap: dataTexture(arm, S, S, false) };
}

/**
 * three r186 ships a stale `examples/jsm/csm/CSMShader.js`: its replacement `lights_fragment_begin`
 * chunk lacks the `#ifdef STANDARD` block that fills `material.dfg` / `multiScatteringCompensation`,
 * so every CSM-patched material gets zero IBL specular (metals render black). Until Sky.ts patches
 * the chunk globally, materials here re-insert that block ahead of the include.
 */
const DFG_FIX = /* glsl */`
#ifdef STANDARD
{
  float dotNVms_fix = saturate( dot( normal, ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition ) ) );
  material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms_fix ) ).rg;
  float EssMs_fix = material.dfg.x + material.dfg.y;
  material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs_fix - 1.0 );
}
#endif
#include <lights_fragment_begin>`;
function fixIBL(mat: THREE.Material, name: string) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', DFG_FIX);
  };
  mat.customProgramCacheKey = () => name + '|dfgfix';
}

// ───────────────────────────── geometry helpers ─────────────────────────────

/** Sweep a tapered rectangle section along a curve (flat spring-steel limb). */
function sweepRect(curve: THREE.Curve<THREE.Vector3>, segs: number, halfW: (t: number) => number, halfH: (t: number) => number): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [], col: number[] = [];
  const p = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const faces = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; // corners in (N, B) space, ring order
  const c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    curve.getPointAt(t, p); curve.getTangentAt(t, T);
    N.crossVectors(T, up).normalize(); B.crossVectors(N, T).normalize();
    const hw = halfW(t), hh = halfH(t);
    for (let k = 0; k < 4; k++) c[k].copy(p).addScaledVector(N, faces[k][0] * hw).addScaledVector(B, faces[k][1] * hh);
    // four faces, each with two verts per ring (hard edges)
    for (let f = 0; f < 4; f++) {
      const a = c[f], b = c[(f + 1) % 4];
      const fn = new THREE.Vector3().subVectors(b, a).cross(T).normalize().negate();
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z); nrm.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z); uv.push(t * 6, 0, t * 6, 1);
      const wear = (f % 2 === 1 ? 0.8 : 0.28) * (0.85 + 0.3 * Math.abs(Math.sin(t * 23 + f))); // edges worn bright, flats blackened
      col.push(wear, wear, wear, wear, wear, wear);
    }
  }
  for (let s = 0; s < segs; s++) for (let f = 0; f < 4; f++) {
    const o = s * 8 + f * 2, n = o + 8;
    idx.push(o, n, o + 1, o + 1, n, n + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Bevelled rectangular ring (iron band) around a w×h section, `len` long, oriented along Z. */
function bandGeometry(w: number, h: number, len: number, thick: number, bevel = 0.0015): THREE.BufferGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2 - thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, -h / 2 - thick); outer.lineTo(w / 2 + thick, h / 2 + thick); outer.lineTo(-w / 2 - thick, h / 2 + thick); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2); hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: len - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -len / 2 + bevel);
  return g;
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
function cyl(rTop: number, rBot: number, len: number, seg: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
function remapUV(g: THREE.BufferGeometry, u0: number, v0: number, su: number, sv: number) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * su, v0 + uv.getY(i) * sv);
  return g;
}
/** Lighten vertex colour on bevel/edge vertices (normals off-axis) → worn, handled edges. */
function edgeWear(g: THREE.BufferGeometry, amount = 0.28) {
  const n = g.getAttribute('normal'), count = n.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const m = Math.max(ax, ay, az);
    const w = clamp01((0.97 - m) / 0.35); // 1 on 45° bevels, 0 on flat faces
    const c = 1 + w * amount;
    colors[i * 3] = c; colors[i * 3 + 1] = c; colors[i * 3 + 2] = c;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
function stripExtra(g: THREE.BufferGeometry) { // non-indexed, only position/normal/uv, so merge works
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  return g;
}

/** Bolt geometry along -Z (tip at -Z). Length 0.36. Single material via atlas UVs. */
function buildBoltGeometry(): THREE.BufferGeometry {
  const L = 0.36, r = 0.0045;
  const parts: THREE.BufferGeometry[] = [];
  // shaft (ash)
  parts.push(remapUV(cyl(r, r, L - 0.05, 10, 0, 0, 0.025, Math.PI / 2), 0, 0.02, 1, 0.44));
  // nock end cap
  parts.push(remapUV(cyl(r * 0.8, r, 0.012, 8, 0, 0, L / 2 - 0.006, Math.PI / 2), 0, 0.02, 1, 0.44));
  // socket (steel)
  parts.push(remapUV(cyl(0.0052, r, 0.03, 8, 0, 0, -L / 2 + 0.04, Math.PI / 2), 0.03, 0.55, 0.42, 0.42));
  // broadhead: flattened 4-sided cone = two-edged blade
  const head = new THREE.ConeGeometry(0.016, 0.07, 4);
  head.rotateY(Math.PI / 4); head.scale(0.22, 1, 1); head.rotateX(-Math.PI / 2); head.translate(0, 0, -L / 2 + 0.035 - 0.035);
  parts.push(remapUV(head, 0.03, 0.55, 0.42, 0.42));
  // fletchings ×3
  for (let k = 0; k < 3; k++) {
    const vane = new THREE.PlaneGeometry(0.075, 0.02);
    vane.translate(0, 0.01 + r * 0.7, 0); vane.rotateY(Math.PI / 2); // plane along Z, standing up from the shaft
    vane.rotateZ((k / 3) * Math.PI * 2 + Math.PI / 2);
    vane.translate(0, 0, L / 2 - 0.06);
    parts.push(remapUV(vane, 0.5, 0.5, 0.5, 0.5));
  }
  const g = mergeGeometries(parts.map(stripExtra), false)!;
  g.computeBoundingSphere();
  return g;
}

// ───────────────────────────── impact particles ─────────────────────────────

const PUFF_COUNT = 6, PUFF_PARTICLES = 14, MAX_PARTICLES = PUFF_COUNT * PUFF_PARTICLES;

class Puffs {
  points: THREE.Points;
  private pos: Float32Array; private vel = new Float32Array(MAX_PARTICLES * 3);
  private life = new Float32Array(MAX_PARTICLES); private maxLife = new Float32Array(MAX_PARTICLES);
  private size: Float32Array; private alpha: Float32Array; private col: Float32Array;
  private posAttr: THREE.BufferAttribute; private alphaAttr: THREE.BufferAttribute; private sizeAttr: THREE.BufferAttribute; private colAttr: THREE.BufferAttribute;
  private cursor = 0;
  private mat: THREE.ShaderMaterial;
  private tmpSize = new THREE.Vector2();
  private rnd = () => Math.random();

  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX_PARTICLES * 3); this.size = new Float32Array(MAX_PARTICLES); this.alpha = new Float32Array(MAX_PARTICLES); this.col = new Float32Array(MAX_PARTICLES * 3);
    g.setAttribute('position', (this.posAttr = new THREE.BufferAttribute(this.pos, 3)));
    g.setAttribute('aSize', (this.sizeAttr = new THREE.BufferAttribute(this.size, 1)));
    g.setAttribute('aAlpha', (this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1)));
    g.setAttribute('aColor', (this.colAttr = new THREE.BufferAttribute(this.col, 3)));
    this.posAttr.setUsage(THREE.DynamicDrawUsage); this.alphaAttr.setUsage(THREE.DynamicDrawUsage); this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.05,-mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d)*4.0; if (r > 1.0 || vA <= 0.001) discard; float a = (1.0 - r) * (1.0 - r) * vA; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  private tmpN = new THREE.Vector3();
  emit(point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface) {
    const n = this.tmpN.copy(dir).negate();
    const cr = surface === 'flesh' ? 0.32 : surface === 'wood' ? 0.58 : 0.42;
    const cg = surface === 'flesh' ? 0.05 : surface === 'wood' ? 0.44 : 0.36;
    const cb = surface === 'flesh' ? 0.04 : surface === 'wood' ? 0.28 : 0.26;
    for (let k = 0; k < PUFF_PARTICLES; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const sp = surface === 'flesh' ? 1.6 : 1.1;
      this.pos[i * 3] = point.x; this.pos[i * 3 + 1] = point.y; this.pos[i * 3 + 2] = point.z;
      this.vel[i * 3] = (n.x + (this.rnd() - 0.5) * 1.4) * sp * (0.4 + this.rnd());
      this.vel[i * 3 + 1] = (n.y + (this.rnd() - 0.5) * 1.4 + 0.4) * sp * (0.4 + this.rnd());
      this.vel[i * 3 + 2] = (n.z + (this.rnd() - 0.5) * 1.4) * sp * (0.4 + this.rnd());
      this.maxLife[i] = this.life[i] = 0.35 + this.rnd() * 0.4;
      this.size[i] = (surface === 'ground' ? 0.05 : 0.025) + this.rnd() * 0.03;
      const v = 0.8 + this.rnd() * 0.4;
      this.col[i * 3] = cr * v; this.col[i * 3 + 1] = cg * v; this.col[i * 3 + 2] = cb * v;
      this.alpha[i] = 1;
    }
    this.colAttr.needsUpdate = true;
  }

  update(dt: number, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    renderer.getDrawingBufferSize(this.tmpSize);
    this.mat.uniforms.uScale.value = this.tmpSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let any = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const g = this.life[i] > 0 ? this.life[i] / this.maxLife[i] : 0;
      this.vel[i * 3 + 1] -= 3.5 * dt;
      this.vel[i * 3] *= 0.94; this.vel[i * 3 + 1] *= 0.94; this.vel[i * 3 + 2] *= 0.94;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = g * 0.85;
      this.size[i] += dt * 0.06;
    }
    if (any) { this.posAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true; }
  }
}

// ───────────────────────────── the crossbow ─────────────────────────────

interface Bolt { mesh: THREE.Mesh; pos: THREE.Vector3; vel: THREE.Vector3; active: boolean; age: number; roll: number }
interface Stuck { mesh: THREE.Mesh; expires: number }

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const NEG_Z = new THREE.Vector3(0, 0, -1), Y_AXIS = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0);

export class Crossbow {
  state = { bolts: MAX_BOLTS, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  /** hold ADS externally (dev `?ads=1`) — OR'ed with the right mouse button */
  adsHeld = false;
  /** dev: 0 = normal, 1 = showcase pose (model centred, three-quarter view, slowly turning) */
  inspect = 0;
  /** dev: reload duration multiplier (1 = normal) */
  reloadScale = 1;
  /** what the crosshair is over (animals only; refreshed every 4th frame, 120 m) */
  aimInfo: { kind: 'deer' | 'boar'; distance: number } | null = null;
  private aimFrame = 0;
  private aimCache = { kind: 'deer' as 'deer' | 'boar', distance: 0 };

  onFire?: () => void;
  onHit?: (kind: 'deer' | 'boar', headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;

  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player; private forest: Forest;
  private targets?: Targets;

  // viewmodel parts we animate
  private stringLeft!: THREE.Mesh; private stringRight!: THREE.Mesh; private serving!: THREE.Mesh;
  private loadedBolt!: THREE.Mesh;
  private tipL = new THREE.Vector3(); private tipR = new THREE.Vector3();
  private nockRest = new THREE.Vector3(); private nockDrawn = new THREE.Vector3();
  private boltGeo!: THREE.BufferGeometry; private boltMat!: THREE.MeshStandardMaterial;

  // animation state
  private draw = 1; private drawVel = 0; private drawTarget = 1;
  private recoil = 0; private kickPending = 0; private kickApplied = 0;
  private cooldown = 0; private sinceFire = 99; private reloadT = 0;
  private mouseAds = false; private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseRot = new THREE.Euler(); private poseInit = false;
  private adsBlend = 0; private sprintBlend = 0; private reloadTilt = 0;

  // projectiles
  private bolts: Bolt[] = [];
  private stuck: Stuck[] = [];
  private puffs = new Puffs();
  private time = 0;
  private spawnPos = new THREE.Vector3();

  constructor(world: CrossbowWorld, targets?: Targets, opts: CrossbowOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player; this.forest = world.forest;
    this.targets = targets;
    this.allowUnlocked = !!opts.allowUnlocked;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.buildViewmodel();
    this.buildProjectiles();
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.game.scene.add(this.puffs.points);
    this.bindInput();
  }

  // ── input ──
  private inputAllowed() { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput() {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) this.tryFire();
      if (e.button === 2) this.mouseAds = true;
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) this.mouseAds = false; });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inputAllowed() || e.repeat) return;
      if (e.code === 'KeyF') this.tryFire();
      if (e.code === 'KeyR') this.reload();
    });
    window.addEventListener('blur', () => { this.mouseAds = false; });
  }

  /** Pull the trigger. Fires if loaded, else starts a reload (and reports a dry click). */
  tryFire() {
    if (this.state.reloading || this.cooldown > 0) return;
    if (!this.state.loaded) { this.onDry?.(); this.reload(); return; }
    this.fire();
  }

  fire() {
    if (!this.state.loaded || this.state.reloading) return;
    this.state.loaded = false;
    this.state.bolts = Math.max(0, this.state.bolts - 1);
    this.cooldown = FIRE_COOLDOWN; this.sinceFire = 0;
    this.drawTarget = 0; this.drawVel = -40; // string snaps forward
    this.recoil = 1; this.kickPending = KICK_PITCH;
    this.spawnBolt();
    this.onFire?.();
  }

  reload() {
    if (this.state.reloading || this.state.loaded || this.state.bolts <= 0) return;
    this.state.reloading = true; this.reloadT = 0; this.state.reloadProgress = 0;
    this.onReloadStart?.();
  }

  addBolts(n: number) { this.state.bolts = Math.min(MAX_BOLTS, this.state.bolts + n); }

  // ── viewmodel ──
  private buildViewmodel() {
    const walnut = makeWalnut(11), steel = makeSteel(23), leather = makeLeather(31), cord = makeCord();
    walnut.map.repeat.set(1, 4); walnut.normalMap.repeat.set(1, 4); walnut.armMap.repeat.set(1, 4);
    const woodMat = new THREE.MeshPhysicalMaterial({ map: walnut.map, normalMap: walnut.normalMap, normalScale: new THREE.Vector2(0.75, 0.75), aoMap: walnut.armMap, roughnessMap: walnut.armMap, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.45, specularIntensity: 0.3 }); // low specularIntensity kills the grazing sunset sheen on the rail
    const ironMat = new THREE.MeshStandardMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), aoMap: steel.armMap, roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.5, metalness: 1, color: new THREE.Color(0.24, 0.23, 0.23), envMapIntensity: 0.6 });
    const prodMat = new THREE.MeshPhysicalMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: steel.armMap, metalnessMap: steel.armMap, roughness: 1.25, metalness: 1, color: new THREE.Color(0.55, 0.55, 0.57), vertexColors: true, anisotropy: 0.8, anisotropyRotation: 0, envMapIntensity: 0.7 });
    steel.map.repeat.set(2, 2); steel.normalMap.repeat.set(2, 2); steel.armMap.repeat.set(2, 2);
    const leatherMat = new THREE.MeshPhysicalMaterial({ map: leather.map, normalMap: leather.normalMap, aoMap: leather.armMap, roughnessMap: leather.armMap, roughness: 1, metalness: 0, specularIntensity: 0.4, envMapIntensity: 0.5 });
    const cordMat = new THREE.MeshStandardMaterial({ map: cord.map, normalMap: cord.normalMap, roughness: 0.85, metalness: 0 });
    const brassMat = new THREE.MeshStandardMaterial({ map: steel.map, normalMap: steel.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughnessMap: steel.armMap, roughness: 1.1, metalness: 1, color: new THREE.Color(0.95, 0.66, 0.3), envMapIntensity: 1.0 });
    ([['xbow-wood', woodMat], ['xbow-iron', ironMat], ['xbow-prod', prodMat], ['xbow-leather', leatherMat], ['xbow-cord', cordMat], ['xbow-brass', brassMat]] as [string, THREE.Material][]).forEach(([n, m]) => { fixIBL(m, n); this.sky.setupMaterial(m); });

    // model space: -Z forward (bolt direction), +Y up, rail top at y=0. Nut at z=+0.14, prod at z=-0.30.
    // ── stock: side profile extruded along X with bevels ──
    const s = new THREE.Shape(); // shape.x = forward (→ -Z), shape.y = up
    s.moveTo(0.40, 0.0);
    s.lineTo(-0.16, 0.0);
    s.quadraticCurveTo(-0.26, -0.006, -0.32, -0.035);
    s.lineTo(-0.43, -0.085);
    s.quadraticCurveTo(-0.455, -0.1, -0.445, -0.125);
    s.lineTo(-0.435, -0.15);
    s.quadraticCurveTo(-0.39, -0.16, -0.34, -0.135);
    s.lineTo(-0.23, -0.088);
    s.quadraticCurveTo(-0.12, -0.062, 0.0, -0.056);
    s.lineTo(0.30, -0.048);
    s.quadraticCurveTo(0.39, -0.046, 0.40, -0.018);
    s.closePath();
    const stockGeo = new THREE.ExtrudeGeometry(s, { depth: 0.038, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 10 });
    stockGeo.rotateY(Math.PI / 2); // shape.x → -Z, extrusion → +X
    stockGeo.translate(-0.019, 0, 0);
    // rail strips (two lighter wood rails with a groove for the bolt)
    const railL = box(0.008, 0.005, 0.52, -0.011, 0.0025, -0.12), railR = box(0.008, 0.005, 0.52, 0.011, 0.0025, -0.12);
    const stockNI = stripExtra(stockGeo);
    const woodGeo = mergeGeometries([stockNI, stripExtra(railL), stripExtra(railR)], false)!;
    edgeWear(woodGeo, 0.18);
    { // the groove rails sit in shadow of the bolt: darker, oil-soaked
      const c = woodGeo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = stockNI.getAttribute('position').count; i < c.count; i++) c.setXYZ(i, c.getX(i) * 0.62, c.getY(i) * 0.6, c.getZ(i) * 0.58);
    }
    const stock = new THREE.Mesh(woodGeo, woodMat);
    this.model.add(stock);

    // ── iron: nut, trigger, guard, tickler, bands, rivets, stirrup, prod bridle, tip caps ──
    const iron: THREE.BufferGeometry[] = [];
    // brass: nut (roller), side inlay strips, thumb plate, rivet heads on the grip
    const brass: THREE.BufferGeometry[] = [];
    brass.push(cyl(0.014, 0.014, 0.042, 18, 0, 0.004, 0.14, 0, 0, Math.PI / 2)); // nut
    brass.push(box(0.032, 0.006, 0.011, 0, 0.012, 0.133)); // nut fingers
    for (const sx of [-1, 1]) brass.push(box(0.0015, 0.0035, 0.30, sx * 0.0245, -0.03, -0.09)); // inlay lines along the flanks
    brass.push(box(0.03, 0.002, 0.05, 0, -0.088, 0.25, 0.3)); // thumb plate on the grip top edge
    const bead = new THREE.SphereGeometry(0.0035, 10, 8); bead.translate(0, 0.009, -0.375); brass.push(bead); // foresight bead
    brass.push(cyl(0.0015, 0.0015, 0.008, 6, 0, 0.004, -0.375)); // bead post
    const brassGeo = mergeGeometries(brass.map(stripExtra), false)!;
    this.model.add(new THREE.Mesh(brassGeo, brassMat));
    // trigger (curved) + guard
    const trig = new THREE.TorusGeometry(0.022, 0.0032, 8, 14, Math.PI * 0.6); trig.rotateY(Math.PI / 2); trig.rotateX(Math.PI * 0.55); trig.translate(0, -0.075, 0.205); iron.push(trig);
    const guard = new THREE.TorusGeometry(0.036, 0.0025, 6, 20, Math.PI); guard.rotateY(Math.PI / 2); guard.rotateX(Math.PI); guard.translate(0, -0.066, 0.21); iron.push(guard);
    // tickler lever under the stock, angled
    iron.push(box(0.012, 0.006, 0.19, 0, -0.088, 0.30, -0.08));
    iron.push(cyl(0.004, 0.004, 0.05, 8, 0, -0.08, 0.215, 0, 0, Math.PI / 2)); // pivot pin
    // bands
    const bandF = bandGeometry(0.048, 0.052, 0.022, 0.003); bandF.translate(0, -0.026, -0.27); iron.push(bandF);
    const bandM = bandGeometry(0.048, 0.062, 0.016, 0.0025); bandM.translate(0, -0.031, 0.02); iron.push(bandM);
    const bandR = bandGeometry(0.046, 0.07, 0.016, 0.0025); bandR.translate(0, -0.045, 0.27); iron.push(bandR);
    // rivets on bands
    for (const [z, y] of [[-0.27, -0.026], [0.02, -0.031], [0.27, -0.045]]) for (const sx of [-1, 1]) {
      iron.push(cyl(0.003, 0.0035, 0.004, 8, sx * 0.028, y, z, 0, 0, Math.PI / 2));
    }
    // prod bridle: a saddle over the stock nose holding the prod
    iron.push(box(0.062, 0.012, 0.03, 0, 0.007, -0.30));
    iron.push(box(0.064, 0.05, 0.012, 0, -0.026, -0.296)); // vertical plate in front of prod
    for (const sx of [-1, 1]) iron.push(cyl(0.0045, 0.0045, 0.04, 8, sx * 0.024, -0.025, -0.283, Math.PI / 2)); // bridle bolts
    // stirrup: two legs + half ring
    for (const sx of [-1, 1]) iron.push(cyl(0.004, 0.004, 0.06, 8, sx * 0.03, -0.055, -0.415, 0, 0, 0));
    const stir = new THREE.TorusGeometry(0.03, 0.004, 8, 18, Math.PI); stir.rotateZ(Math.PI); stir.translate(0, -0.085, -0.415); iron.push(stir);
    iron.push(box(0.07, 0.008, 0.02, 0, -0.03, -0.41)); // stirrup mount plate
    // limb tip caps
    this.tipL.set(-0.335, 0.004, -0.205); this.tipR.set(0.335, 0.004, -0.205);
    for (const tip of [this.tipL, this.tipR]) iron.push(box(0.022, 0.024, 0.012, tip.x, tip.y, tip.z));
    // butt plate
    const butt = box(0.046, 0.06, 0.006, 0, -0.115, 0.44, 0.4); iron.push(butt);
    const ironGeo = mergeGeometries(iron.map(stripExtra), false)!;
    this.model.add(new THREE.Mesh(ironGeo, ironMat));

    // ── prod (steel limbs) ──
    const prodCurve = new THREE.CatmullRomCurve3([
      this.tipL.clone(), new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), this.tipR.clone(),
    ], false, 'catmullrom', 0.5);
    const prodGeo = sweepRect(prodCurve, 40, (t) => 0.008 - Math.abs(t - 0.5) * 0.009, (t) => 0.021 - Math.abs(t - 0.5) * 0.022);
    this.model.add(new THREE.Mesh(prodGeo, prodMat));

    // ── string (2 legs + serving), updated every frame ──
    const legGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 1, 7); legGeo.translate(0, 0.5, 0);
    this.stringLeft = new THREE.Mesh(legGeo, cordMat); this.stringRight = new THREE.Mesh(legGeo, cordMat);
    const servGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.055, 8); servGeo.rotateZ(Math.PI / 2);
    this.serving = new THREE.Mesh(servGeo, cordMat);
    this.model.add(this.stringLeft, this.stringRight, this.serving);
    this.nockRest.set(0, 0.009, -0.215); this.nockDrawn.set(0, 0.009, 0.128);
    // cord whipping around the stock nose
    const wrap = new THREE.CylinderGeometry(0.031, 0.031, 0.024, 10); wrap.rotateX(Math.PI / 2); wrap.translate(0, -0.025, -0.34);
    this.model.add(new THREE.Mesh(wrap, cordMat));

    // ── leather grip ──
    const gripShape = new THREE.Shape(); // rounded rectangle section
    const gw = 0.026, gh = 0.047, gr = 0.012;
    gripShape.moveTo(-gw + gr, -gh); gripShape.lineTo(gw - gr, -gh); gripShape.quadraticCurveTo(gw, -gh, gw, -gh + gr);
    gripShape.lineTo(gw, gh - gr); gripShape.quadraticCurveTo(gw, gh, gw - gr, gh); gripShape.lineTo(-gw + gr, gh);
    gripShape.quadraticCurveTo(-gw, gh, -gw, gh - gr); gripShape.lineTo(-gw, -gh + gr); gripShape.quadraticCurveTo(-gw, -gh, -gw + gr, -gh);
    const grip = new THREE.ExtrudeGeometry(gripShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 3, curveSegments: 6 });
    grip.rotateX(0.35); grip.translate(0, -0.074, 0.30);
    const fw = 0.0245, fh = 0.033, fr = 0.009; const foreShape = new THREE.Shape();
    foreShape.moveTo(-fw + fr, -fh); foreShape.lineTo(fw - fr, -fh); foreShape.quadraticCurveTo(fw, -fh, fw, -fh + fr); foreShape.lineTo(fw, fh - fr); foreShape.quadraticCurveTo(fw, fh, fw - fr, fh); foreShape.lineTo(-fw + fr, fh); foreShape.quadraticCurveTo(-fw, fh, -fw, fh - fr); foreShape.lineTo(-fw, -fh + fr); foreShape.quadraticCurveTo(-fw, -fh, -fw + fr, -fh);
    const fore = new THREE.ExtrudeGeometry(foreShape, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 6 });
    fore.translate(0, -0.03, -0.24); // forearm wrap between the front band and the mid band
    this.model.add(new THREE.Mesh(fore, leatherMat));
    this.model.add(new THREE.Mesh(grip, leatherMat));

    // ── loaded bolt on the rail ──
    const atlas = makeBoltAtlas(41);
    this.boltGeo = buildBoltGeometry();
    this.boltMat = new THREE.MeshStandardMaterial({ map: atlas.map, normalMap: atlas.normalMap, aoMap: atlas.armMap, roughnessMap: atlas.armMap, metalnessMap: atlas.armMap, roughness: 1, metalness: 1, alphaTest: 0.5, side: THREE.DoubleSide });
    fixIBL(this.boltMat, 'xbow-bolt'); this.sky.setupMaterial(this.boltMat);
    this.loadedBolt = new THREE.Mesh(this.boltGeo, this.boltMat);
    this.loadedBolt.position.set(0, 0.0095, 0.128 - 0.18);
    this.model.add(this.loadedBolt);

    // depth-clear so the viewmodel never clips into world geometry; render after everything opaque
    // The clearer and the viewmodel live in the *transparent* queue (renderOrder 999/1000) so the
    // depth clear happens after every world transparent (boundary lines, mist, halos) has drawn —
    // otherwise those would paint over the whole scene with the cleared depth buffer.
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = o !== clearer;
      if (o === clearer) return;
      m.renderOrder = 1000;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) { mat.transparent = true; mat.depthWrite = true; }
    });
    this.model.scale.setScalar(1.35);
  }

  private buildProjectiles() {
    for (let i = 0; i < MAX_FLYING; i++) {
      const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      mesh.visible = false; mesh.castShadow = true; mesh.frustumCulled = false;
      this.game.scene.add(mesh);
      this.bolts.push({ mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), active: false, age: 0, roll: 0 });
    }
  }

  private spawnBolt() {
    let b = this.bolts.find((x) => !x.active);
    if (!b) { b = this.bolts.reduce((a, x) => (x.age > a.age ? x : a)); }
    const cam = this.game.camera;
    cam.getWorldDirection(_fwd);
    // spread: tight at ADS, a touch wider from the hip
    const spread = THREE.MathUtils.degToRad(0.15 + (1 - this.adsBlend) * 0.6);
    _dir.copy(_fwd);
    _v1.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).cross(_fwd).normalize();
    _dir.addScaledVector(_v1, Math.tan(spread * Math.random())).normalize();
    // start where the rail bolt is (so it visibly leaves the weapon) but travel along the aim line
    this.loadedBolt.getWorldPosition(this.spawnPos);
    _v2.copy(cam.position).addScaledVector(_fwd, 0.35);
    b.pos.copy(this.spawnPos).lerp(_v2, this.adsBlend * 0.8);
    b.vel.copy(_dir).multiplyScalar(BOLT_SPEED);
    b.active = true; b.age = 0; b.roll = 0;
    b.mesh.visible = true;
    b.mesh.position.copy(b.pos);
    b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir);
  }

  // ── per-frame ──
  update(dt: number, t: number) {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceFire += dt;

    // auto reload
    if (!this.state.loaded && !this.state.reloading && this.state.bolts > 0 && this.sinceFire > AUTO_RELOAD_DELAY) this.reload();
    if (this.state.reloading) {
      this.reloadT += dt / this.reloadScale;
      const pr = Math.min(1, this.reloadT / RELOAD_DURATION);
      this.state.reloadProgress = pr;
      this.drawTarget = sstep(0.18, 0.78, pr);
      if (pr >= 1) { this.state.reloading = false; this.state.loaded = true; this.drawTarget = 1; this.onReloadEnd?.(); }
    }
    // string spring (stiff, slightly under-damped so the release overshoots)
    const k = this.state.reloading ? 260 : 1400, c = this.state.reloading ? 28 : 34;
    this.drawVel += (-(this.draw - this.drawTarget) * k - this.drawVel * c) * dt;
    this.draw += this.drawVel * dt;
    this.updateString();

    // loaded bolt: visible once the reload is ~85 % through (slides in from the rear)
    const showBolt = this.state.loaded || (this.state.reloading && this.state.reloadProgress > 0.8);
    this.loadedBolt.visible = showBolt;
    if (showBolt && this.state.reloading) {
      const slide = 1 - sstep(0.8, 1, this.state.reloadProgress);
      this.loadedBolt.position.z = 0.128 - 0.18 + slide * 0.12;
      this.loadedBolt.position.y = 0.0095 + slide * 0.02;
    } else { this.loadedBolt.position.z = 0.128 - 0.18; this.loadedBolt.position.y = 0.0095; }

    // ADS + FOV
    this.state.ads = (this.mouseAds || this.adsHeld) && this.enabled && !this.state.reloading && !p.sprinting;
    this.adsBlend += ((this.state.ads ? 1 : 0) - this.adsBlend) * Math.min(1, dt * 9);
    const targetFov = fovForAspect(FOV_HIP + (FOV_ADS - FOV_HIP) * sstep(0, 1, this.adsBlend), cam.aspect);
    if (Math.abs(targetFov - this.fov) > 0.01) {
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums();
    }

    // recoil + camera kick (kick up on fire, recover smoothly)
    this.recoil *= Math.exp(-dt * 9);
    if (this.kickPending > 0) { const a = Math.min(this.kickPending, KICK_PITCH * dt * 40); p.pitch += a; this.kickApplied += a; this.kickPending -= a; }
    else if (this.kickApplied > 0) { const r = this.kickApplied * Math.min(1, dt * 6); p.pitch -= r; this.kickApplied -= r; }

    // look lag (spring)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    // stiff spring (k=220): explicit Euler blows up once k·dt² > 1 (≈ 15 fps on a phone) → substep at ≤ 1/120 s
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw, -0.12, 0.12); this.lagPitch = THREE.MathUtils.clamp(this.lagPitch, -0.1, 0.1);

    // pose blend: hip ↔ ADS ↔ sprint ↔ reload
    this.sprintBlend += ((p.sprinting ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);
    const rl = this.state.reloading ? Math.sin(Math.min(1, this.state.reloadProgress) * Math.PI) : 0;
    this.reloadTilt += (rl - this.reloadTilt) * Math.min(1, dt * 10);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const a = sstep(0, 1, this.adsBlend), sp = this.sprintBlend * (1 - portrait * 0.7), rt = this.reloadTilt; // portrait: the sprint swing would fill the frame
    // hip: lower-right (Skyrim), ADS: centred and a little closer to the eye
    let px = THREE.MathUtils.lerp(0.12, 0.0, a), py = THREE.MathUtils.lerp(-0.165, -0.115, a), pz = THREE.MathUtils.lerp(-0.27, -0.31, a);
    let rx = THREE.MathUtils.lerp(0.035, 0.0, a), ry = THREE.MathUtils.lerp(0.13, 0.0, a), rz = THREE.MathUtils.lerp(0.04, 0.0, a);
    // sprint: drop and swing across the body
    px += sp * -0.05; py += sp * -0.09; pz += sp * 0.04; rx += sp * 0.32; ry += sp * 0.45; rz += sp * -0.15;
    // reload: tilt the bow up-left to reach the string, crank shake
    const crank = this.state.reloading ? Math.sin(this.state.reloadProgress * Math.PI * 14) * (this.state.reloadProgress > 0.15 && this.state.reloadProgress < 0.8 ? 1 : 0) : 0;
    px += rt * -0.06; py += rt * -0.05; pz += rt * 0.02; rx += rt * 0.35 + crank * 0.008; ry += rt * -0.28; rz += rt * 0.42 + crank * 0.012;
    // breathing / idle sway
    px += Math.sin(t * 0.7) * 0.0025 * (1 - a * 0.7); py += Math.sin(t * 1.1) * 0.002 * (1 - a * 0.7); rz += Math.sin(t * 0.5) * 0.006 * (1 - a);
    // walk bob (counter-phase to the camera bob → the weapon feels heavy)
    const sf = p.speedFactor * (1 - a * 0.6);
    px += Math.cos(p.bobTime) * 0.016 * sf; py += -Math.abs(Math.sin(p.bobTime)) * 0.012 * sf; rz += Math.cos(p.bobTime) * 0.02 * sf; rx += Math.sin(p.bobTime * 2) * 0.01 * sf;
    // look lag
    ry += this.lagYaw; rx += this.lagPitch; px += this.lagYaw * 0.25; py += this.lagPitch * 0.2;
    // recoil
    pz += this.recoil * 0.07; py += this.recoil * 0.015; rx += this.recoil * 0.12; rz += this.recoil * -0.03;

    if (this.inspect) { px = 0.02; py = -0.02; pz = -0.42; rx = 0.35; ry = 0.9 + Math.sin(t * 0.25) * 0.5; rz = 0.1; }
    // portrait phone: the wider FOV + narrow frame make the bow fill the screen — hold it lower, further out, smaller
    const port = portrait;
    // target: the whole prod visible inside ~60 % of the screen width (prod ≈ 0.68 m × scale at |pz| + 0.3 × scale)
    px *= 1 - port * 0.25; py *= 1 + port * 0.7; pz *= 1 + port * 1.5;
    this.model.scale.setScalar(1.35 * (1 - port * 0.55));
    const sm = this.poseInit ? Math.min(1, dt * 14) : 1; this.poseInit = true;
    this.posePos.x += (px - this.posePos.x) * sm; this.posePos.y += (py - this.posePos.y) * sm; this.posePos.z += (pz - this.posePos.z) * sm;
    this.poseRot.x += (rx - this.poseRot.x) * sm; this.poseRot.y += (ry - this.poseRot.y) * sm; this.poseRot.z += (rz - this.poseRot.z) * sm;
    this.model.position.copy(this.posePos);
    this.model.rotation.set(this.poseRot.x, this.poseRot.y, this.poseRot.z);

    // aim readout
    if (this.targets && (++this.aimFrame & 3) === 0) {
      cam.getWorldDirection(_fwd);
      const hit = this.targets.raycast(cam.position, _fwd, 120);
      if (hit && hit.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.stepBolts(dt);
    this.puffs.update(dt, this.game.renderer, cam);
    while (this.stuck.length && this.stuck[0].expires < t) this.removeStuck(0);
  }

  private updateString() {
    const d = THREE.MathUtils.clamp(this.draw, -0.12, 1.05);
    const nock = _v1.copy(this.nockRest).lerp(this.nockDrawn, d);
    nock.y = this.nockRest.y + (1 - Math.abs(d - 0.5) * 2) * 0.002;
    this.placeLeg(this.stringLeft, this.tipL, nock);
    this.placeLeg(this.stringRight, this.tipR, nock);
    this.serving.position.copy(nock);
    this.serving.quaternion.setFromUnitVectors(X_AXIS, _v2.subVectors(this.tipR, this.tipL).normalize());
  }
  private placeLeg(leg: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
    leg.position.copy(from);
    _v3.subVectors(to, from);
    const len = _v3.length();
    leg.scale.set(1, len, 1);
    leg.quaternion.setFromUnitVectors(Y_AXIS, _v3.multiplyScalar(1 / len));
  }

  // ── projectiles ──
  private stepBolts(dt: number) {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.age += dt;
      const sub = 4, h = dt / sub;
      for (let s = 0; s < sub; s++) {
        _v1.copy(b.pos); // previous
        b.vel.y -= GRAVITY * h;
        b.vel.multiplyScalar(1 - BOLT_DRAG * h * b.vel.length() * 0.1);
        b.pos.addScaledVector(b.vel, h);
        if (this.testHit(b, _v1)) break;
      }
      if (!b.active) continue;
      if (Math.abs(b.pos.x) > CHUNK_HALF + 60 || Math.abs(b.pos.z) > CHUNK_HALF + 60 || b.pos.y < -150 || b.age > 12) { b.active = false; b.mesh.visible = false; continue; }
      b.mesh.position.copy(b.pos);
      _dir.copy(b.vel).normalize();
      b.roll += dt * 14;
      b.mesh.quaternion.setFromUnitVectors(NEG_Z, _dir).multiply(_q2.setFromAxisAngle(NEG_Z, b.roll));
    }
  }

  /** segment prev→b.pos vs animals, trees, terrain. Returns true when the bolt stopped. */
  private testHit(b: Bolt, prev: THREE.Vector3): boolean {
    _dir.subVectors(b.pos, prev);
    const segLen = _dir.length();
    if (segLen < 1e-6) return false;
    _dir.multiplyScalar(1 / segLen);

    // animals
    if (this.targets) {
      const hit = this.targets.raycast(prev, _dir, segLen);
      if (hit) {
        const killed = hit.animal.applyDamage(hit.headshot ? HEAD_DAMAGE : BODY_DAMAGE, hit.point, _dir);
        this.onHit?.(hit.animal.kind, hit.headshot, killed);
        this.stopBolt(b, hit.point, _dir, 'flesh', false);
        return true;
      }
    }
    // tree trunks (tapered cylinders)
    for (const tr of this.forest.nearby(b.pos.x, b.pos.z, 1)) {
      const tf = this.segmentCylinder(prev, _dir, segLen, tr.x, tr.z, Math.max(0.08, tr.r - 0.12), tr.y, tr.y + tr.height * 0.8);
      if (tf >= 0) {
        _v2.copy(prev).addScaledVector(_dir, tf);
        this.stopBolt(b, _v2, _dir, 'wood', true);
        return true;
      }
    }
    // terrain
    if (b.pos.y < heightAt(b.pos.x, b.pos.z)) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 5; i++) {
        const mid = (lo + hi) / 2;
        _v2.copy(prev).addScaledVector(_dir, segLen * mid);
        if (_v2.y < heightAt(_v2.x, _v2.z)) hi = mid; else lo = mid;
      }
      _v2.copy(prev).addScaledVector(_dir, segLen * lo);
      this.stopBolt(b, _v2, _dir, 'ground', true);
      return true;
    }
    return false;
  }

  /** distance along the segment where it enters a cylinder whose radius tapers to 20 % at yTop, or -1 */
  private segmentCylinder(o: THREE.Vector3, d: THREE.Vector3, len: number, cx: number, cz: number, r: number, yBot: number, yTop: number): number {
    const ox = o.x - cx, oz = o.z - cz;
    const a = d.x * d.x + d.z * d.z;
    if (a < 1e-8) return -1;
    const bq = 2 * (ox * d.x + oz * d.z);
    let rr = r;
    for (let pass = 0; pass < 2; pass++) {
      const c = ox * ox + oz * oz - rr * rr;
      const disc = bq * bq - 4 * a * c;
      if (disc < 0) return -1;
      const t = (-bq - Math.sqrt(disc)) / (2 * a);
      if (t < 0 || t > len) return -1;
      const y = o.y + d.y * t;
      if (y < yBot || y > yTop) return -1;
      if (pass === 1) return t;
      rr = r * (1 - 0.8 * clamp01((y - yBot) / (yTop - yBot)));
    }
    return -1;
  }

  private stopBolt(b: Bolt, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, stick: boolean) {
    b.active = false; b.mesh.visible = false;
    this.puffs.emit(point, dir, surface);
    this.onImpact?.(surface, point);
    if (!stick) return;
    // stick: keep a static mesh with the head buried ~10 cm in the surface
    if (this.stuck.length >= MAX_STUCK) this.removeStuck(0);
    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
    mesh.castShadow = true;
    mesh.position.copy(point).addScaledVector(dir, -0.18 + 0.10); // geometry centre sits 0.18 behind the tip
    mesh.quaternion.setFromUnitVectors(NEG_Z, dir).multiply(_q.setFromAxisAngle(NEG_Z, b.roll));
    this.game.scene.add(mesh);
    this.stuck.push({ mesh, expires: this.time + STUCK_LIFETIME });
  }
  private removeStuck(i: number) {
    const s = this.stuck.splice(i, 1)[0];
    this.game.scene.remove(s.mesh);
  }

  /** flying bolt count (for debugging / HUD) */
  get inFlight() { let n = 0; for (const b of this.bolts) if (b.active) n++; return n; }
  get stuckCount() { return this.stuck.length; }
}
