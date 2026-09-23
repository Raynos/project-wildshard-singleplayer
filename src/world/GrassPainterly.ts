import * as THREE from 'three';
import { SEED } from '../core/config';
import { Rng } from '../core/rng';
import { TIER } from '../core/tier';
import { heightAt, normalAt, trailDistance } from './Heightfield';
import { attachFogUniforms } from './Atmosphere';
import type { Sky } from './Sky';
import type { Forest } from './Forest';
import { noReflect } from './Water';
import { wind, WIND_GLSL } from './Wind';
import { trample, TRAMPLE_GLSL } from './GrassTrample';
import { grassBaseHeightAt, grassToneAt, flowerKindAt } from './GrassField';
import { painterlyUniforms } from './painterly';

/**
 * The painterly grass carpet (Nalati, style B — `art/nalati-grasslands/round-1/1-art-style/style-B-painterly.png`).
 *
 *   const carpet = new GrassPainterly(sky, forest).build();   // Grass.ts does this when the shard is painterly
 *   scene.add(carpet.group);
 *   game.onUpdate((dt) => carpet.update(dt, player.position)); // also drives `wind` and `trample`
 *
 * Individual tapered blades, not textured cards — no texture, no alpha test, no discard, so the tile GPUs keep
 * their hidden-surface removal. Two instanced draws on one material family:
 *
 *  - **near** (≤ 18 m desktop / 11 m phone): tufts of 14 (phone 11) curved blades, 3 segments each, plus one
 *    flower stem with a camera-facing head (purple sage spike · white edelweiss · yellow buttercup) that is
 *    collapsed when the tuft carries no flower;
 *  - **far** (to 56 m / 40 m): clumps of 7 single-triangle blades + a flower dot — painted strokes; beyond that
 *    the painted terrain is the carpet.
 *  Near and far cross-fade stochastically over a 5 m band (each instance flips at its own random radius).
 *
 * Instances live in a 4 m cell grid that follows the player (toroidal slot tables, a cell is reseeded from a
 * hash of its coordinates when it enters the window, so the same square metre always grows the same grass).
 * Per instance: position + yaw, slope, height (the GrassField — tall feather-grass bands, grazed turf, trails),
 * tone (valley green → plateau gold), flower kind, random. Everything else is the vertex shader: blades are
 * constant-length arcs bent by one vector = static curl + `wind` (the travelling gust fronts of Wind.ts +
 * flutter) + `trample` (the persistent trample map + up to 16 live movers), root → tip colour gradient
 * (dark olive → green → warm gold, silvery plumes on the tall feather grass, straw blades), a gust sheen that
 * makes the wind waves visible, and the distance LOD.
 *
 * Lighting: MeshStandardMaterial through `sky.setupMaterial` (CSM shadows, fog, hemisphere / IBL), then the
 * direct term is re-shaded soft-cel: N·L × shadow → two soft bands; shadows keep the sky-tinted ambient (never
 * black); thin blades glow when backlit.
 */

const PHONE = TIER === 'phone';
const CELL = 4;
const NEAR_R = PHONE ? 11 : 18;          // metres: tuft ring
const FAR_R = PHONE ? 40 : 56;           // metres: clump ring
const BAND = 5;                          // metres: near ↔ far cross-fade band (inside NEAR_R)
const FADE = 8;                          // metres: outer fade of the far ring
const NEAR_N = Math.ceil((NEAR_R * 2) / CELL) + 1;  // cells per side (even-ised below)
const FAR_N = Math.ceil((FAR_R * 2) / CELL);
const NEAR_K = PHONE ? 44 : 64;          // tufts per 4 m cell
const FAR_K = PHONE ? 20 : 30;           // clumps per 4 m cell
const NEAR_BLADES = PHONE ? 14 : 18;
const NEAR_SEGS = 3;
const FAR_BLADES = 7;

/** sRGB hex → linear Color */
const lin = (hex: number) => new THREE.Color().setHex(hex, THREE.SRGBColorSpace);

/** the grass palette (also what the painterly terrain should paint under / beyond the carpet) */
export const GRASS_PALETTE = {
  root: 0x2f3d14,       // dark olive
  midValley: 0x4f8a1e,  // fresh green
  midPlateau: 0x7f9530, // olive-gold
  tipValley: 0xc4d64a,  // yellow-green
  tipPlateau: 0xf0cf5c, // warm gold
  plume: 0xf2e7c0,      // feather-grass plumes
  straw: 0xd9bf78,      // dry blades
  sheen: 0xfff1c2,      // the back of a blade pushed by a gust
  sage: 0x9460d6,
  edelweiss: 0xe9e5d8,
  buttercup: 0xf5c526,
};

const grassUniforms = {
  uNearR: { value: NEAR_R },
  uFarR: { value: FAR_R },
  uBand: { value: BAND },
  uFade: { value: FADE },
  uRoot: { value: lin(GRASS_PALETTE.root) },
  uMidV: { value: lin(GRASS_PALETTE.midValley) },
  uMidP: { value: lin(GRASS_PALETTE.midPlateau) },
  uTipV: { value: lin(GRASS_PALETTE.tipValley) },
  uTipP: { value: lin(GRASS_PALETTE.tipPlateau) },
  uPlume: { value: lin(GRASS_PALETTE.plume) },
  uStraw: { value: lin(GRASS_PALETTE.straw) },
  uSheen: { value: lin(GRASS_PALETTE.sheen) },
  uFlower1: { value: lin(GRASS_PALETTE.sage) },
  uFlower2: { value: lin(GRASS_PALETTE.edelweiss) },
  uFlower3: { value: lin(GRASS_PALETTE.buttercup) },
  /** live tunables (dev harness): x = sheen, y = backlight, z = direct gain, w = ambient gain */
  uLook: { value: new THREE.Vector4(1, 1, 1, 1) },
};

// ---------------------------------------------------------------------------------- geometry

interface GeoBuf { aBlade: number[]; aShape: number[]; aKind: number[]; pos: number[]; idx: number[] }

function pushBlade(b: GeoBuf, rx: number, rz: number, face: number, width: number, hf: number, rnd: number, segs: number, kind: number) {
  const base = b.pos.length / 3;
  for (let s = 0; s < segs; s++) {
    const t = s / segs;
    for (const side of [-1, 1]) {
      b.aBlade.push(rx, rz, t, side); b.aShape.push(face, width, hf, rnd); b.aKind.push(kind); b.pos.push(rx, t, rz);
    }
  }
  b.aBlade.push(rx, rz, 1, 0); b.aShape.push(face, width, hf, rnd); b.aKind.push(kind); b.pos.push(rx, 1, rz);
  for (let s = 0; s < segs - 1; s++) {
    const a = base + s * 2;
    b.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const l = base + (segs - 1) * 2;
  b.idx.push(l, base + segs * 2, l + 1);
}

/** a flower head: a centre + `rim` vertices on the unit circle, camera-facing in the shader */
function pushHead(b: GeoBuf, rx: number, rz: number, face: number, hf: number, rnd: number, rim: number) {
  const base = b.pos.length / 3;
  b.aBlade.push(rx, rz, 1, 0); b.aShape.push(face, 0, hf, rnd); b.aKind.push(3); b.pos.push(rx, 1, rz);
  for (let i = 0; i < rim; i++) {
    const a = (i / rim) * Math.PI * 2 + 0.3;
    b.aBlade.push(rx, rz, 1, Math.sin(a)); b.aShape.push(face, Math.cos(a), hf, rnd); b.aKind.push(2); b.pos.push(rx, 1, rz);
  }
  for (let i = 0; i < rim; i++) b.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % rim));
}

function finish(b: GeoBuf): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(b.aBlade, 4));
  g.setAttribute('aShape', new THREE.Float32BufferAttribute(b.aShape, 4));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(b.aKind, 1));
  g.setIndex(b.idx);
  return g;
}

/** a tuft: `n` blades on a unit disc (the shader scales the spread with height) + a flower stem and head */
function buildTuft(n: number, segs: number, seed: number, near: boolean): THREE.InstancedBufferGeometry {
  const rng = new Rng(seed);
  const b: GeoBuf = { aBlade: [], aShape: [], aKind: [], pos: [], idx: [] };
  for (let i = 0; i < n; i++) {
    // sunflower-spiral roots so the disc fills evenly
    const r = Math.sqrt((i + 0.5) / n) * rng.range(0.85, 1.05);
    const a = i * 2.39996 + rng.range(-0.3, 0.3);
    const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
    const face = a + rng.range(-0.7, 0.7);           // curl outward, loosely
    const width = near ? rng.range(0.02, 0.038) : rng.range(0.08, 0.13);
    const hf = (near ? rng.range(0.5, 1.1) : rng.range(0.65, 1.0)) * (1.05 - 0.2 * r);
    pushBlade(b, rx, rz, face, width, hf, rng.next(), segs, 0);
  }
  // flower stem (kind 1) + head (kinds 2 rim / 3 centre); collapsed when the instance has no flower
  const fa = rng.range(0, Math.PI * 2), fr = rng.range(0.1, 0.4), frnd = rng.next();
  const frx = Math.cos(fa) * fr, frz = Math.sin(fa) * fr, fhf = rng.range(1.02, 1.15);
  pushBlade(b, frx, frz, fa, near ? 0.012 : 0.03, fhf, frnd, near ? 2 : 1, 1);
  pushHead(b, frx, frz, fa, fhf, frnd, near ? 6 : 4);
  return finish(b);
}

// ---------------------------------------------------------------------------------- shader

const VERT_PARS = /* glsl */`
attribute vec4 aBlade;   // root.xz (unit disc), t along the blade, side (−1 / 0 tip / +1) — heads: hy
attribute vec4 aShape;   // facing angle, width (m) — heads: hx, height factor, rnd
attribute float aKind;   // 0 blade · 1 flower stem · 2 head rim · 3 head centre
attribute vec4 iPos;     // x, y, z, yaw
attribute vec4 iData;    // height (m), tone, flower kind, rnd
attribute vec2 iSlope;   // dy/dx, dy/dz of the ground
uniform float uNearR; uniform float uFarR; uniform float uBand; uniform float uFade;
uniform vec3 uRoot; uniform vec3 uMidV; uniform vec3 uMidP; uniform vec3 uTipV; uniform vec3 uTipP;
uniform vec3 uPlume; uniform vec3 uStraw; uniform vec3 uSheen;
uniform vec3 uFlower1; uniform vec3 uFlower2; uniform vec3 uFlower3;
uniform vec4 uLook;
varying vec3 vGCol;
varying float vGT;
${WIND_GLSL}
${TRAMPLE_GLSL}
`;

const VERT_BLADE = (near: boolean) => /* glsl */`
vec3 objectNormal;
vec3 bladePos;
{
  float yaw = iPos.w;
  float cy = cos( yaw ), sy = sin( yaw );
  float H0 = iData.x; float tone = iData.y; float fkind = iData.z; float irnd = iData.w;
  float dist = distance( iPos.xyz, cameraPosition );
  float vis = 1.0 - smoothstep( uFarR - uFade, uFarR, dist );
  float thr = uNearR - uBand * irnd;
  ${near
    ? 'vis *= 1.0 - smoothstep( thr - 0.8, thr, dist );'
    : `vis *= smoothstep( thr - 0.8, thr, dist );
  // thin the far ring: 45 % of the clumps bow out between 55 and 80 % of it, the rest widen to cover
  if ( fract( irnd * 7.13 ) < 0.45 ) vis *= 1.0 - smoothstep( uFarR * 0.55, uFarR * 0.8, dist );`}
  if ( aKind > 0.5 && fkind < 0.5 ) vis = 0.0;
  // a wide, even spread (tufts overlap at 4 / m²) so the carpet has no clumps, whatever the height
  float spread = ${near ? '0.36 + 0.12' : '0.42 + 0.15'} * min( H0, 1.25 );
  vec2 lr = vec2( aBlade.x * cy - aBlade.y * sy, aBlade.x * sy + aBlade.y * cy ) * spread;
  vec3 root = vec3( iPos.x + lr.x, iPos.y + dot( lr, iSlope ), iPos.z + lr.y );
  float face = aShape.x + yaw;
  vec2 fdir = vec2( cos( face ), sin( face ) );
  float rnd = aShape.w;
  float H = H0 * aShape.z * vis;
  // one bend vector: static curl (taller blades droop more) + wind + trample
  vec2 B = fdir * ( 0.45 * ( 1.0 - smoothstep( 0.15, 0.5, H0 ) ) + 0.14 + 0.5 * fract( rnd * 3.7 + irnd ) * fract( rnd * 3.7 + irnd ) + 0.3 * smoothstep( 0.6, 1.1, H0 ) );
  float g = windGust( root.xz );
  float spd = uWindSpeed;
  float push = ( 0.04 + spd * 0.03 ) * ( 0.35 + 1.25 * g * uWindGustiness + ( 1.0 - uWindGustiness ) * 0.3 );
  float flut = sin( uWindTime * ( 3.5 + 3.0 * rnd ) + root.x * 2.1 + root.z * 1.7 + rnd * 6.28 ) * ( 0.03 + spd * 0.007 );
  B += uWindDir * push + vec2( - uWindDir.y, uWindDir.x ) * flut;
  B += trampleBend( root.xz );
  float bl = length( B );
  float th = min( bl, 1.5 );
  vec2 bd = B / max( bl, 1e-4 );
  float t = aBlade.z;
  float a = th * t;
  float along = th < 1e-3 ? 0.0 : ( 1.0 - cos( a ) ) / th * H;
  float up = th < 1e-3 ? t * H : sin( a ) / th * H;
  vec3 tang = vec3( bd.x * sin( a ), cos( a ), bd.y * sin( a ) );
  vec3 c = root + vec3( bd.x * along, up, bd.y * along );
  vec3 wdir = vec3( - fdir.y, 0.0, fdir.x );
  vec3 mid = mix( uMidV, uMidP, tone );
  vec3 tip = mix( uTipV, uTipP, tone );
  float tall = smoothstep( 0.8, 1.05, H0 );
  tip = mix( tip, uPlume, tall * step( 0.5, fract( rnd * 5.3 + irnd ) ) * 0.85 );
  float dry = step( 0.9, fract( rnd * 11.7 + irnd * 3.1 ) );
  tip = mix( tip, uStraw, dry * 0.8 ); mid = mix( mid, uStraw * 0.75, dry * 0.5 );
  // short turf has no deep shade between its blades: a lighter root
  vec3 rootC = mix( mix( uRoot, mid, 0.55 ), uRoot, smoothstep( 0.2, 0.6, H0 ) );
  vec3 col = t < 0.4 ? mix( rootC, mid, t / 0.4 ) : mix( mid, tip, ( t - 0.4 ) / 0.6 );
  col *= 0.72 + 0.42 * fract( rnd * 7.1 + irnd * 1.7 );
  col = mix( col, col * vec3( 0.8, 1.0, 0.75 ), step( 0.6, fract( irnd * 3.3 ) ) * 0.6 ); // a greener, darker tuft here and there
  // gust sheen: blades pushed flat by a front show their pale backs — the visible wind waves
  float sheen = g * sqrt( g ) * uWindGustiness * smoothstep( 1.0, 7.0, spd ) * uLook.x;
  col = mix( col, uSheen, sheen * smoothstep( 0.2, 1.0, t ) * 0.6 );
  if ( aKind < 1.5 ) {
    // grazed turf: short blades go broader and splay, so a 0.2 m lawn still reads as a carpet, not stubble
    float w = aShape.y * vis * ( 1.0 - 0.85 * t * t ) * mix( 1.5, 1.0, smoothstep( 0.15, 0.55, H0 ) );
    bladePos = c + wdir * aBlade.w * w * 0.5;
    vec3 n = normalize( cross( wdir, tang ) );
    n *= sign( dot( n, vec3( 0.0, 1.0, 0.0 ) ) + 1e-3 );
    objectNormal = normalize( n * 0.5 + vec3( 0.0, 1.0, 0.0 ) );
    if ( aKind > 0.5 ) col = mix( uRoot, mix( uMidV, uMidP, 0.5 ) * 0.8, t );
  } else {
    // flower head: camera-facing at the stem tip; sage is a tall spike, the others a disc
    vec3 toCam = normalize( cameraPosition - c );
    vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
    vec3 upv = cross( toCam, right );
    vec2 sz = fkind < 1.5 ? vec2( 0.011, 0.065 ) : ( fkind < 2.5 ? vec2( 0.026, 0.026 ) : vec2( 0.019, 0.019 ) );
    sz *= ${near ? '1.0' : '1.5'} * ( 0.8 + 0.5 * fract( irnd * 13.1 ) ) * vis;
    bladePos = c + right * aShape.y * sz.x + upv * ( aBlade.w * sz.y + ( fkind < 1.5 ? sz.y * 0.8 : 0.0 ) );
    objectNormal = vec3( 0.0, 1.0, 0.0 );
    vec3 fc = fkind < 1.5 ? uFlower1 : ( fkind < 2.5 ? uFlower2 : uFlower3 );
    // centre: a warm eye on the daisies / edelweiss, a darker core on the others
    col = aKind > 2.5 ? ( fkind > 1.5 && fkind < 2.5 ? vec3( 0.95, 0.62, 0.08 ) : fc * 0.6 ) : fc;
    t = 1.0;
  }
  vGCol = col;
  vGT = t;
}
`;

const FRAG_RELIGHT = /* glsl */`
{
  // soft cel: the lit share (N·L × shadow) of the standard direct term → two soft bands; the shadow side
  // keeps the sky-tinted ambient (IBL + hemisphere), never black; blades glow when backlit
  vec3 alb = max( diffuseColor.rgb, vec3( 1e-4 ) );
  const vec3 LUM = vec3( 0.2126, 0.7152, 0.0722 );
  vec3 sunC = uPSunRef;
  vec3 sunV = normalize( ( viewMatrix * vec4( uPSunDir, 0.0 ) ).xyz );
  float ref = dot( alb * sunC * RECIPROCAL_PI, LUM );
  float lit = clamp( dot( reflectedLight.directDiffuse, LUM ) / max( ref, 1e-5 ), 0.0, 1.0 );
  // grass is thin and translucent: the lit share is wrapped up so a low sun still reaches the top band
  float band = 0.45 * smoothstep( 0.03, 0.12, lit ) + 0.55 * smoothstep( 0.18, 0.36, lit );
  float back = pow( max( dot( normalize( - vViewPosition ), sunV ), 0.0 ), 4.0 ) * vGT * smoothstep( 0.03, 0.15, lit );
  reflectedLight.directDiffuse = alb * RECIPROCAL_PI * ( sunC * ( band * 0.95 + back * 0.9 * uLook.y ) + uPShade * ( 1.0 - band ) * 0.6 ) * uLook.z;
  reflectedLight.indirectDiffuse *= ( 0.8 + 0.25 * vGT ) * uLook.w;
  reflectedLight.directSpecular = vec3( 0.0 );
  reflectedLight.indirectSpecular = vec3( 0.0 );
}
#include <aomap_fragment>
`;

function buildMaterial(sky: Sky, near: boolean): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    attachFogUniforms(shader);
    Object.assign(shader.uniforms, grassUniforms, wind.uniforms, trample.uniforms,
      { uPSunRef: painterlyUniforms.uPSunRef, uPSunDir: painterlyUniforms.uPSunDir, uPShade: painterlyUniforms.uPShade });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <beginnormal_vertex>', VERT_BLADE(near))
      .replace('#include <begin_vertex>', 'vec3 transformed = bladePos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGCol;\nvarying float vGT;\nuniform vec4 uLook;\nuniform vec3 uPSunRef;\nuniform vec3 uPSunDir;\nuniform vec3 uPShade;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb = vGCol;')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <aomap_fragment>', FRAG_RELIGHT);
  };
  mat.customProgramCacheKey = () => (near ? 'grass-painterly-near' : 'grass-painterly-far');
  sky.setupMaterial(mat);
  return mat;
}

// ---------------------------------------------------------------------------------- cell layer

/** one instanced layer on the 4 m cell grid (toroidal slots, reseed on entry) */
class Layer {
  readonly mesh: THREE.Mesh;
  private readonly iPos: THREE.InstancedBufferAttribute;
  private readonly iData: THREE.InstancedBufferAttribute;
  private readonly iSlope: THREE.InstancedBufferAttribute;
  private readonly keyX: Int32Array;
  private readonly keyZ: Int32Array;
  private queue: number[] = [];
  private queued = new Set<number>();
  private lastX = 0x7fffffff;
  private lastZ = 0x7fffffff;
  /** live instances (height > 0) — for the perf report */
  live = 0;
  private liveBy: Int32Array;

  constructor(geo: THREE.InstancedBufferGeometry, mat: THREE.Material, readonly n: number, readonly k: number,
    private readonly seedCell: (cx: number, cz: number, pos: Float32Array, data: Float32Array, slope: Float32Array, base: number) => number) {
    const count = n * n * k;
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.iData = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.iSlope = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    for (const a of [this.iPos, this.iData, this.iSlope]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos);
    geo.setAttribute('iData', this.iData);
    geo.setAttribute('iSlope', this.iSlope);
    geo.instanceCount = count;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.keyX = new Int32Array(n * n).fill(0x7fffffff);
    this.keyZ = new Int32Array(n * n).fill(0x7fffffff);
    this.liveBy = new Int32Array(n * n);
  }

  private slotOf(cx: number, cz: number) { const n = this.n; return (((cx % n) + n) % n) * n + (((cz % n) + n) % n); }

  update(px: number, pz: number, perFrame: number): void {
    let budget = perFrame;
    const pcx = Math.floor(px / CELL), pcz = Math.floor(pz / CELL);
    const half = this.n >> 1;
    if (pcx !== this.lastX || pcz !== this.lastZ) {
      const first = this.lastX === 0x7fffffff;
      this.lastX = pcx; this.lastZ = pcz;
      for (let cx = pcx - half; cx < pcx - half + this.n; cx++) for (let cz = pcz - half; cz < pcz - half + this.n; cz++) {
        const s = this.slotOf(cx, cz);
        if (this.keyX[s] === cx && this.keyZ[s] === cz) continue;
        const key = cx * 100000 + cz;
        if (!this.queued.has(key)) { this.queued.add(key); this.queue.push(key); }
      }
      const dec = (k: number): [number, number] => { const x = Math.floor((k + 50000) / 100000); return [x, k - x * 100000]; };
      this.queue.sort((a, b) => {
        const [ax, az] = dec(a), [bx, bz] = dec(b);
        return (ax - pcx) ** 2 + (az - pcz) ** 2 - ((bx - pcx) ** 2 + (bz - pcz) ** 2);
      });
      if (first) budget = Infinity;
    }
    if (this.queue.length > this.n * this.n * 0.6) budget = Infinity; // a teleport: fill at once
    let done = 0, dirty = false;
    while (this.queue.length > 0 && done < budget) {
      const key = this.queue.shift();
      if (key === undefined) break;
      this.queued.delete(key);
      const cx = Math.floor((key + 50000) / 100000), cz = key - cx * 100000;
      if (cx < this.lastX - half || cx >= this.lastX - half + this.n || cz < this.lastZ - half || cz >= this.lastZ - half + this.n) continue;
      const s = this.slotOf(cx, cz);
      this.keyX[s] = cx; this.keyZ[s] = cz;
      const base = s * this.k;
      const live = this.seedCell(cx, cz, this.iPos.array as Float32Array, this.iData.array as Float32Array, this.iSlope.array as Float32Array, base);
      this.live += live - (this.liveBy[s] ?? 0); this.liveBy[s] = live;
      this.iPos.addUpdateRange(base * 4, this.k * 4);
      this.iData.addUpdateRange(base * 4, this.k * 4);
      this.iSlope.addUpdateRange(base * 2, this.k * 2);
      done++; dirty = true;
    }
    if (dirty) { this.iPos.needsUpdate = true; this.iData.needsUpdate = true; this.iSlope.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------------------------- the carpet

export class GrassPainterly {
  group = new THREE.Group();
  near!: Layer;
  far!: Layer;
  /** live tunables */
  params = { budget: 6, playerRadius: 0.55 };
  private lastPX = Number.NaN;
  private lastPZ = Number.NaN;

  constructor(private sky: Sky, private forest: Forest) {}

  build(): this {
    // the painterly sun reference (unshadowed colour × intensity, direction) — painterly.ts keeps the same numbers
    const l = this.sky.csm.lights[0];
    if (l) painterlyUniforms.uPSunRef.value.copy(l.color).multiplyScalar(l.intensity);
    painterlyUniforms.uPSunDir.value.copy(this.sky.sunDir).normalize();
    const nearN = NEAR_N + (NEAR_N & 1), farN = FAR_N + (FAR_N & 1);
    this.near = new Layer(buildTuft(NEAR_BLADES, NEAR_SEGS, SEED + 7101, true), buildMaterial(this.sky, true), nearN, NEAR_K,
      (cx, cz, p, d, s, b) => this.seed(cx, cz, p, d, s, b, NEAR_K, 1));
    this.far = new Layer(buildTuft(FAR_BLADES, 1, SEED + 7102, false), buildMaterial(this.sky, false), farN, FAR_K,
      (cx, cz, p, d, s, b) => this.seed(cx, cz, p, d, s, b, FAR_K, 2));
    this.near.mesh.name = 'grass-near'; this.far.mesh.name = 'grass-far';
    this.group.add(this.near.mesh, this.far.mesh);
    noReflect(this.group);
    return this;
  }

  /** triangles per instance (near tuft, far clump) — for the perf report */
  get trisPerInstance(): [number, number] {
    const t = (m: THREE.Mesh) => (m.geometry.index?.count ?? 0) / 3;
    return [t(this.near.mesh), t(this.far.mesh)];
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // the player parts the grass and leaves a trail
    const vx = Number.isNaN(this.lastPX) || dt <= 0 ? 0 : (playerPos.x - this.lastPX) / dt;
    const vz = Number.isNaN(this.lastPZ) || dt <= 0 ? 0 : (playerPos.z - this.lastPZ) / dt;
    this.lastPX = playerPos.x; this.lastPZ = playerPos.z;
    if (vx * vx + vz * vz < 900) trample.push(playerPos.x, playerPos.z, this.params.playerRadius, 1, vx, vz);
    wind.update(dt);
    // the shared painterly sway (spruce, flags) follows the same wind
    painterlyUniforms.uPWind.value.set(wind.dirX, wind.dirZ, wind.speed / 5);
    trample.update(dt, playerPos);
    this.near.update(playerPos.x, playerPos.z, this.params.budget);
    this.far.update(playerPos.x, playerPos.z, this.params.budget);
  }

  private seed(cx: number, cz: number, pos: Float32Array, data: Float32Array, slope: Float32Array, base: number, K: number, salt: number): number {
    const rng = new Rng(((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(SEED + salt, 83492791)) >>> 0) + 1);
    const x0 = cx * CELL, z0 = cz * CELL;
    const mx = x0 + CELL / 2, mz = z0 + CELL / 2;
    const nrm = normalAt(mx, mz, 1.0);
    const ny = Math.max(0.3, nrm[1]);
    const sx = -nrm[0] / ny, sz = -nrm[2] / ny;
    const trees = this.forest.nearby(mx, mz, 3.5);
    const nearTrail = trailDistance(mx, mz) < 7 + CELL;
    const flowerScale = salt === 1 ? 1 : NEAR_K / FAR_K;
    let live = 0;
    for (let k = 0; k < K; k++) {
      const x = x0 + rng.next() * CELL, z = z0 + rng.next() * CELL;
      const hv = rng.range(0.8, 1.15), yaw = rng.range(0, Math.PI * 2), rnd = rng.next(), f1 = rng.next(), f2 = rng.next(), tv = rng.next();
      const i = base + k;
      let h = grassBaseHeightAt(x, z, nearTrail ? trailDistance(x, z) : Infinity) * hv;
      if (h > 0.04) for (const tr of trees) { const dx = tr.x - x, dz = tr.z - z; if (dx * dx + dz * dz < (tr.r + 0.35) ** 2) { h = 0; break; } }
      if (h <= 0.04) { data[i * 4] = 0; pos[i * 4 + 1] = -1e4; continue; }
      live++;
      pos[i * 4] = x; pos[i * 4 + 1] = heightAt(x, z) - 0.03; pos[i * 4 + 2] = z; pos[i * 4 + 3] = yaw;
      data[i * 4] = h;
      data[i * 4 + 1] = Math.min(1, Math.max(0, grassToneAt(x, z) + (tv - 0.5) * 0.16));
      data[i * 4 + 2] = flowerKindAt(x, z, h, f1 / flowerScale, f2);
      data[i * 4 + 3] = rnd;
      slope[i * 2] = sx; slope[i * 2 + 1] = sz;
    }
    return live;
  }
}
