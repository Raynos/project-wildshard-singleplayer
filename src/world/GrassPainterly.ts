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
import { grassBaseHeightAt, grassToneAt, flowerKindAt, groundColorAt } from './GrassField';
import { painterlyUniforms } from './painterly';

/**
 * The painterly grass carpet (Nalati, style B — `art/nalati-grasslands/round-1/1-art-style/style-B-painterly.png`,
 * `docs/design/nalati/look-pass.md` lever 4).
 *
 *   const carpet = new GrassPainterly(sky, forest).build();   // Grass.ts does this when the shard is painterly
 *   scene.add(carpet.group);
 *   game.onUpdate((dt) => carpet.update(dt, player.position)); // also drives `wind` and `trample`
 *
 * Individual blades, not textured cards — no texture, no alpha test, no discard, so the tile GPUs keep their
 * hidden-surface removal. Two instanced draws:
 *
 *  - **near** (≤ 20 m desktop / 10 m phone): clumps of 16 (phone 11) wide, soft, leaf-shaped blades — 4 (phone 3)
 *    segments, full width to two thirds then a pointed tip, rounded normals across the width, arcing over under
 *    their own weight — plus two flower stems whose heads (purple sage spike · white edelweiss · yellow buttercup,
 *    camera-facing) collapse when the clump carries no flower;
 *  - **far** (to 60 m / 42 m): clumps of 7 (phone 5) two-segment wide strokes + one flower dot; their colour and
 *    height melt into the painted ground over the outer 45 % of the ring, so there is no edge — beyond it the
 *    terrain is the carpet.
 *  Near and far cross-fade stochastically over a 5 m band (each instance flips at its own random radius).
 *
 * Instances live in a 4 m cell grid that follows the player (toroidal slot tables, a cell is reseeded from a
 * hash of its coordinates when it enters the window, so the same square metre always grows the same grass).
 * Per instance: position + yaw, slope, the painted ground colour under it (the def's `groundColor`, so roots sink
 * into the ground and the grass takes the hills' gold / green / olive patches), height (GrassField: feather-grass
 * stealth fields, grazed turf, trails), tone (valley green → plateau gold), flower kind (drifts), random.
 * Everything else is the vertex shader: blades are constant-length arcs bent by one vector = static droop +
 * `wind` (Wind.ts gust fronts + flutter) + `trample` (the trample map + 16 live movers); root → tip gradient
 * (deep olive → green → warm gold / fresh green, feather plumes, straw blades); a sun-sheen that rolls across
 * the field with the gust fronts; distance LOD.
 *
 * Light — the painterly model (src/world/painterly.ts `RE_Direct_Lambert`): the lit share N·L × shadow goes
 * through the same two soft cel bands (`pCel`), the unlit part takes the painted shade tint `uPShade`, the
 * hemisphere / sky fill stays as ambient; grass wraps the light a little (thin leaves), glows when backlit and
 * carries the gust sheen. MeshStandardMaterial through `sky.setupMaterial` for CSM shadows + fog.
 */

const PHONE = TIER === 'phone';
const CELL = 4;
const NEAR_R = PHONE ? 10 : 20;          // metres: clump ring
const FAR_R = PHONE ? 42 : 60;           // metres: stroke ring
const BAND = 5;                          // metres: near ↔ far cross-fade band (inside NEAR_R)
const FADE = 6;                          // metres: outer fade of the far ring (the colour melts into the ground before it)
const NEAR_N = Math.ceil((NEAR_R * 2) / CELL) + 1;  // cells per side (even-ised below)
const FAR_N = Math.ceil((FAR_R * 2) / CELL);
const NEAR_K = PHONE ? 72 : 64;          // clumps per 4 m cell
const FAR_K = 24;                                  // strokes per 4 m cell
const NEAR_BLADES = PHONE ? 11 : 16;
const NEAR_SEGS = PHONE ? 3 : 4;
const FAR_BLADES = PHONE ? 5 : 7;

/** sRGB hex → linear Color */
const lin = (hex: number) => new THREE.Color().setHex(hex, THREE.SRGBColorSpace);

/** the grass palette (the ground colour under each clump is mixed in on top — see the header) */
export const GRASS_PALETTE = {
  root: 0x27340f,       // deep olive
  midValley: 0x4f8a1e,  // fresh green
  midPlateau: 0x86962e, // olive-gold
  tipValley: 0xc9dc5a,  // fresh yellow-green
  tipPlateau: 0xf2cf62, // warm gold
  plume: 0xf2e7c0,      // feather-grass plumes
  straw: 0xd9bf78,      // dry blades
  sheen: 0xfff0c0,      // the sun on blades a gust has laid over
  sage: 0x8c55d6,
  sageLight: 0xc4a3f0,
  edelweiss: 0xf1eee4,
  buttercup: 0xf7c81e,
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
  uFlower1b: { value: lin(GRASS_PALETTE.sageLight) },
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

/** a flower head: a centre + `rim` vertices on the unit circle, camera-facing in the shader; `k` = kind base (2 / 12) */
function pushHead(b: GeoBuf, rx: number, rz: number, face: number, hf: number, rnd: number, rim: number, k: number) {
  const base = b.pos.length / 3;
  b.aBlade.push(rx, rz, 1, 0); b.aShape.push(face, 0, hf, rnd); b.aKind.push(k + 1); b.pos.push(rx, 1, rz);
  for (let i = 0; i < rim; i++) {
    const a = (i / rim) * Math.PI * 2 + 0.3;
    b.aBlade.push(rx, rz, 1, Math.sin(a)); b.aShape.push(face, Math.cos(a), hf, rnd); b.aKind.push(k); b.pos.push(rx, 1, rz);
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

/**
 * A clump: `n` blades on a unit disc (the shader scales the spread with height), + `flowers` stems with heads.
 * aKind: 0 blade · 1 / 11 stem · 2 / 12 head rim · 3 / 13 head centre (the 1x set is the second flower).
 */
function buildClump(n: number, segs: number, seed: number, near: boolean, flowers: number): THREE.InstancedBufferGeometry {
  const rng = new Rng(seed);
  const b: GeoBuf = { aBlade: [], aShape: [], aKind: [], pos: [], idx: [] };
  for (let i = 0; i < n; i++) {
    // sunflower-spiral roots, denser in the middle: a clump, not a lawn
    const r = ((i + 0.5) / n) ** 0.7 * rng.range(0.8, 1.05);
    const a = i * 2.39996 + rng.range(-0.3, 0.3);
    const rx = Math.cos(a) * r, rz = Math.sin(a) * r;
    const face = a + rng.range(-0.6, 0.6);           // arc outward, loosely
    const width = near ? rng.range(0.034, 0.064) : rng.range(0.09, 0.15);
    // varied heights: a few tall leaders, a lot of middle, short ones at the rim
    const hf = (near ? rng.range(0.45, 1.12) : rng.range(0.6, 1.05)) * (1.08 - 0.3 * r);
    pushBlade(b, rx, rz, face, width, hf, rng.next(), segs, 0);
  }
  for (let f = 0; f < flowers; f++) {
    const fa = rng.range(0, Math.PI * 2), fr = rng.range(0.15, 0.6), frnd = rng.next();
    const frx = Math.cos(fa) * fr, frz = Math.sin(fa) * fr, fhf = rng.range(0.95, 1.2);
    pushBlade(b, frx, frz, fa, near ? 0.01 : 0.03, fhf, frnd, near ? 2 : 1, 1 + f * 10);
    pushHead(b, frx, frz, fa, fhf, frnd, near ? 6 : 4, 2 + f * 10);
  }
  return finish(b);
}

// ---------------------------------------------------------------------------------- shader

const VERT_PARS = /* glsl */`
attribute vec4 aBlade;   // root.xz (unit disc), t along the blade, side (−1 / 0 tip / +1) — heads: hy
attribute vec4 aShape;   // facing angle, width (m) — heads: hx, height factor, rnd
attribute float aKind;   // 0 blade · 1 / 11 flower stem · 2 / 12 head rim · 3 / 13 head centre
attribute vec4 iPos;     // x, y, z, yaw
attribute vec4 iData;    // height (m), tone, flower kind (+ 0.5 = two heads), rnd
attribute vec2 iSlope;   // dy/dx, dy/dz of the ground
attribute vec3 iGround;  // the painted ground colour under the clump (linear)
uniform float uNearR; uniform float uFarR; uniform float uBand; uniform float uFade;
uniform vec3 uRoot; uniform vec3 uMidV; uniform vec3 uMidP; uniform vec3 uTipV; uniform vec3 uTipP;
uniform vec3 uPlume; uniform vec3 uStraw;
uniform vec3 uFlower1; uniform vec3 uFlower1b; uniform vec3 uFlower2; uniform vec3 uFlower3;
uniform vec4 uLook;
varying vec3 vGCol;
varying float vGT;
varying float vSheen;
${WIND_GLSL}
${TRAMPLE_GLSL}
`;

const VERT_BLADE = (near: boolean) => /* glsl */`
vec3 objectNormal;
vec3 bladePos;
{
  float yaw = iPos.w;
  float cy = cos( yaw ), sy = sin( yaw );
  float H0 = iData.x; float tone = iData.y; float irnd = iData.w;
  float fkind = floor( iData.z + 0.01 );
  float twoHeads = step( 0.25, fract( iData.z ) );
  float kind = mod( aKind, 10.0 );
  float second = step( 9.5, aKind );
  float dist = distance( iPos.xyz, cameraPosition );
  float vis = 1.0 - smoothstep( uFarR - uFade, uFarR, dist );
  float thr = uNearR - uBand * irnd;
  float melt = 0.0;
  ${near
    ? 'vis *= 1.0 - smoothstep( thr - 0.8, thr, dist );'
    : `vis *= smoothstep( thr - 0.8, thr, dist );
  // the outer ring melts into the painted ground: colour first, then height
  melt = smoothstep( uFarR * 0.55, uFarR - uFade, dist );
  vis *= 1.0 - 0.55 * melt;`}
  if ( kind > 0.5 && ( fkind < 0.5 || second * ( 1.0 - twoHeads ) > 0.5 ) ) vis = 0.0;
  if ( vis <= 0.0 ) {
    // outside the ring / cross-faded out / no flower: collapse cheaply (the whole instance takes this branch)
    bladePos = vec3( iPos.x, -1e4, iPos.z ); objectNormal = vec3( 0.0, 1.0, 0.0 );
    vGCol = vec3( 0.0 ); vGT = 0.0; vSheen = 0.0;
  } else {
  float spread = ${near ? '0.2 + 0.14' : '0.34 + 0.16'} * min( H0, 1.25 );
  vec2 lr = vec2( aBlade.x * cy - aBlade.y * sy, aBlade.x * sy + aBlade.y * cy ) * spread;
  vec3 root = vec3( iPos.x + lr.x, iPos.y + dot( lr, iSlope ), iPos.z + lr.y );
  float face = aShape.x + yaw;
  vec2 fdir = vec2( cos( face ), sin( face ) );
  float rnd = aShape.w;
  float H = H0 * aShape.z * vis;
  // one bend vector: static droop (long leaves arc over under their own weight) + wind + trample
  float r1 = fract( rnd * 3.7 + irnd );
  vec2 B = fdir * ( 0.25 + 0.55 * r1 * r1 + 0.35 * smoothstep( 0.35, 1.1, H0 * aShape.z ) + 0.3 * ( 1.0 - smoothstep( 0.15, 0.45, H0 ) ) );
  if ( kind > 0.5 ) B *= 0.35; // flower stems stand up
  float g = windGust( root.xz );
  float spd = uWindSpeed;
  float push = ( 0.04 + spd * 0.03 ) * ( 0.35 + 1.25 * g * uWindGustiness + ( 1.0 - uWindGustiness ) * 0.3 );
  float flut = sin( uWindTime * ( 3.5 + 3.0 * rnd ) + root.x * 2.1 + root.z * 1.7 + rnd * 6.28 ) * ( 0.03 + spd * 0.007 );
  B += uWindDir * push + vec2( - uWindDir.y, uWindDir.x ) * flut;
  B += trampleBend( root.xz );
  float bl = length( B );
  float th = min( bl, 1.55 );
  vec2 bd = B / max( bl, 1e-4 );
  float t = aBlade.z;
  float a = th * t;
  float along = th < 1e-3 ? 0.0 : ( 1.0 - cos( a ) ) / th * H;
  float up = th < 1e-3 ? t * H : sin( a ) / th * H;
  vec3 tang = vec3( bd.x * sin( a ), cos( a ), bd.y * sin( a ) );
  vec3 c = root + vec3( bd.x * along, up, bd.y * along );
  vec3 wdir = vec3( - fdir.y, 0.0, fdir.x );
  // colour: deep olive root sunk into the painted ground → green → warm gold / fresh green tip; the clump takes
  // the ground's patch hue so the hills carry gold / green / olive patches
  vec3 gnd = iGround;
  vec3 mid = mix( mix( uMidV, uMidP, tone ), gnd, 0.45 );
  vec3 tip = mix( mix( uTipV, uTipP, tone ), gnd * 1.9, 0.18 );
  float tall = smoothstep( 0.8, 1.05, H0 );
  tip = mix( tip, uPlume, tall * step( 0.55, fract( rnd * 5.3 + irnd ) ) * 0.8 );
  float dry = step( 0.9, fract( rnd * 11.7 + irnd * 3.1 ) );
  tip = mix( tip, uStraw, dry * 0.8 ); mid = mix( mid, uStraw * 0.75, dry * 0.4 );
  vec3 rootC = mix( uRoot, gnd * 0.45, 0.5 );
  rootC = mix( mix( rootC, mid, 0.5 ), rootC, smoothstep( 0.2, 0.6, H0 ) ); // short turf: no deep shade under it
  vec3 col = t < 0.35 ? mix( rootC, mid, t / 0.35 ) : mix( mid, tip, ( t - 0.35 ) / 0.65 );
  col *= 0.8 + 0.34 * fract( rnd * 7.1 + irnd * 1.7 );
  col = mix( col, col * vec3( 0.82, 1.0, 0.78 ), step( 0.62, fract( irnd * 3.3 ) ) * 0.5 ); // a lusher clump here and there
  // sun-sheen: the blades a gust front lays over catch the sun — it rolls across the field with the fronts
  vSheen = g * sqrt( g ) * uWindGustiness * smoothstep( 1.0, 6.0, spd ) * smoothstep( 0.25, 1.0, t ) * uLook.x;
  if ( kind < 1.5 ) {
    // leaf: full width to ~2/3, then a soft point; a little narrower at the base
    float w = aShape.y * vis * ( 1.0 - pow( t, 2.4 ) ) * ( 0.8 + 0.2 * smoothstep( 0.0, 0.25, t ) );
    w *= mix( 1.35, 1.0, smoothstep( 0.15, 0.55, H0 ) ); // grazed turf splays broader
    bladePos = c + wdir * aBlade.w * w * 0.5;
    vec3 n = normalize( cross( wdir, tang ) );
    n *= sign( dot( n, vec3( 0.0, 1.0, 0.0 ) ) + 1e-3 );
    // rounded across the width (a soft leaf, not a flat card), then biased up like the ground it covers
    n = normalize( n + wdir * aBlade.w * 0.55 );
    objectNormal = normalize( n * 0.55 + vec3( 0.0, 1.0, 0.0 ) );
    if ( kind > 0.5 ) col = mix( rootC, mix( uMidV, uMidP, tone ) * 0.75, t );
  } else {
    // flower head: camera-facing at the stem tip; sage is a tall spike, edelweiss / buttercup a disc
    vec3 toCam = normalize( cameraPosition - c );
    vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
    vec3 upv = cross( toCam, right );
    vec2 sz = fkind < 1.5 ? vec2( 0.012, 0.1 ) : ( fkind < 2.5 ? vec2( 0.03, 0.03 ) : vec2( 0.022, 0.022 ) );
    sz *= ${near ? '1.0' : '1.6'} * ( 0.8 + 0.5 * fract( irnd * 13.1 + second * 0.37 ) ) * vis;
    bladePos = c + right * aShape.y * sz.x + upv * ( aBlade.w * sz.y + ( fkind < 1.5 ? sz.y * 0.8 : 0.0 ) );
    objectNormal = normalize( toCam * 0.4 + vec3( 0.0, 1.0, 0.0 ) );
    vec3 fc = fkind < 1.5 ? uFlower1 : ( fkind < 2.5 ? uFlower2 : uFlower3 );
    vec3 centre = fkind < 1.5 ? uFlower1b : ( fkind < 2.5 ? vec3( 0.9, 0.72, 0.25 ) : vec3( 0.95, 0.45, 0.04 ) );
    col = kind > 2.5 ? centre : fc;
    if ( fkind < 1.5 ) col = mix( fc * 0.7, uFlower1b, clamp( aBlade.w * 0.5 + 0.5, 0.0, 1.0 ) ); // sage: dark base → lilac tip
    t = 1.0;
    vSheen = 0.0;
  }
  // far ring: melt into the painted ground (lit the same way, it reads as the terrain carrying on)
  col = mix( col, gnd * ( 0.85 + 0.35 * t ), melt );
  vGCol = col;
  vGT = t;
  }
}
`;

const FRAG_RELIGHT = /* glsl */`
{
  // the painterly light model (painterly.ts RE_Direct_Lambert): lit share N·L × shadow → pCel's two soft bands,
  // the unlit part takes the painted shade tint, the sky fill stays ambient. Grass wraps the light a little (thin
  // leaves), glows when backlit, and carries the gust sheen.
  vec3 alb = max( diffuseColor.rgb, vec3( 1e-4 ) );
  const vec3 LUM = vec3( 0.2126, 0.7152, 0.0722 );
  vec3 sunC = uPSunRef;
  vec3 sunV = normalize( ( viewMatrix * vec4( uPSunDir, 0.0 ) ).xyz );
  float ref = dot( alb * sunC * RECIPROCAL_PI, LUM );
  float lit = clamp( dot( reflectedLight.directDiffuse, LUM ) / max( ref, 1e-5 ), 0.0, 1.0 );
  float lw = min( 1.0, lit * 1.35 );
  float band = mix( lw, 0.52 * smoothstep( 0.03, 0.13, lw ) + 0.48 * smoothstep( 0.34, 0.5, lw ), 0.8 );
  float sunlit = smoothstep( 0.02, 0.12, lit );
  float back = pow( max( dot( normalize( - vViewPosition ), sunV ), 0.0 ), 4.0 ) * vGT * sunlit;
  // the shade tint is kept light on grass: its own shadowed blades are the olive of the gradient, not blue
  vec3 irr = sunC * ( band + back * 0.85 * uLook.y + vSheen * 0.9 * sunlit ) + uPShade * ( 1.0 - band ) * 0.45;
  reflectedLight.directDiffuse = alb * RECIPROCAL_PI * irr * uLook.z + uSheenAdd * vSheen * sunlit * 0.1;
  reflectedLight.indirectDiffuse *= ( 0.85 + 0.25 * vGT ) * uLook.w;
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
      { uPSunRef: painterlyUniforms.uPSunRef, uPSunDir: painterlyUniforms.uPSunDir, uPShade: painterlyUniforms.uPShade, uSheenAdd: grassUniforms.uSheen });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <beginnormal_vertex>', VERT_BLADE(near))
      .replace('#include <begin_vertex>', 'vec3 transformed = bladePos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGCol; varying float vGT; varying float vSheen;
        uniform vec4 uLook; uniform vec3 uPSunRef; uniform vec3 uPSunDir; uniform vec3 uPShade; uniform vec3 uSheenAdd;`)
      .replace('#include <color_fragment>', 'diffuseColor.rgb = vGCol;')
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <aomap_fragment>', FRAG_RELIGHT);
  };
  mat.customProgramCacheKey = () => (near ? 'grass-painterly-near' : 'grass-painterly-far');
  sky.setupMaterial(mat);
  return mat;
}

// ---------------------------------------------------------------------------------- cell layer

interface Slots { pos: Float32Array; data: Float32Array; slope: Float32Array; ground: Float32Array }

/** one instanced layer on the 4 m cell grid (toroidal slots, reseed on entry) */
class Layer {
  readonly mesh: THREE.Mesh;
  private readonly iPos: THREE.InstancedBufferAttribute;
  private readonly iData: THREE.InstancedBufferAttribute;
  private readonly iSlope: THREE.InstancedBufferAttribute;
  private readonly iGround: THREE.InstancedBufferAttribute;
  private readonly slots: Slots;
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
    private readonly seedCell: (cx: number, cz: number, s: Slots, base: number) => number) {
    const count = n * n * k;
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.iData = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.iSlope = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    this.iGround = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    for (const a of [this.iPos, this.iData, this.iSlope, this.iGround]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos);
    geo.setAttribute('iData', this.iData);
    geo.setAttribute('iSlope', this.iSlope);
    geo.setAttribute('iGround', this.iGround);
    this.slots = {
      pos: this.iPos.array as Float32Array, data: this.iData.array as Float32Array,
      slope: this.iSlope.array as Float32Array, ground: this.iGround.array as Float32Array,
    };
    // park every slot far below until its cell is seeded
    for (let i = 0; i < count; i++) this.slots.pos[i * 4 + 1] = -1e4;
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
      const live = this.seedCell(cx, cz, this.slots, base);
      this.live += live - (this.liveBy[s] ?? 0); this.liveBy[s] = live;
      this.iPos.addUpdateRange(base * 4, this.k * 4);
      this.iData.addUpdateRange(base * 4, this.k * 4);
      this.iSlope.addUpdateRange(base * 2, this.k * 2);
      this.iGround.addUpdateRange(base * 3, this.k * 3);
      done++; dirty = true;
    }
    if (dirty) { this.iPos.needsUpdate = true; this.iData.needsUpdate = true; this.iSlope.needsUpdate = true; this.iGround.needsUpdate = true; }
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
  private gnd: [number, number, number] = [0, 0, 0];

  constructor(private sky: Sky, private forest: Forest) {}

  build(): this {
    // the painterly sun reference (unshadowed colour × intensity, direction) — painterly.ts keeps the same numbers
    const l = this.sky.csm.lights[0];
    if (l) painterlyUniforms.uPSunRef.value.copy(l.color).multiplyScalar(l.intensity);
    painterlyUniforms.uPSunDir.value.copy(this.sky.sunDir).normalize();
    const nearN = NEAR_N + (NEAR_N & 1), farN = FAR_N + (FAR_N & 1);
    this.near = new Layer(buildClump(NEAR_BLADES, NEAR_SEGS, SEED + 7101, true, 2), buildMaterial(this.sky, true), nearN, NEAR_K,
      (cx, cz, s, b) => this.seed(cx, cz, s, b, NEAR_K, 1));
    this.far = new Layer(buildClump(FAR_BLADES, 2, SEED + 7102, false, 1), buildMaterial(this.sky, false), farN, FAR_K,
      (cx, cz, s, b) => this.seed(cx, cz, s, b, FAR_K, 2));
    this.near.mesh.name = 'grass-near'; this.far.mesh.name = 'grass-far';
    this.group.add(this.near.mesh, this.far.mesh);
    noReflect(this.group);
    return this;
  }

  /** triangles per instance (near clump, far clump) — for the perf report */
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

  private seed(cx: number, cz: number, s: Slots, base: number, K: number, salt: number): number {
    const rng = new Rng(((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(SEED + salt, 83492791)) >>> 0) + 1);
    const x0 = cx * CELL, z0 = cz * CELL;
    const mx = x0 + CELL / 2, mz = z0 + CELL / 2;
    const nrm = normalAt(mx, mz, 1.0);
    const ny = Math.max(0.3, nrm[1]);
    const sx = -nrm[0] / ny, sz = -nrm[2] / ny;
    const trees = this.forest.nearby(mx, mz, 3.5);
    const nearTrail = trailDistance(mx, mz) < 9.5 + CELL;
    // a cell on an edge (a road bed, gravel, rock, water): test the painted ground per clump, not per 4 m corner
    const edge = grassBaseHeightAt(x0, z0, Infinity) * grassBaseHeightAt(x0 + CELL, z0, Infinity) * grassBaseHeightAt(x0, z0 + CELL, Infinity) * grassBaseHeightAt(x0 + CELL, z0 + CELL, Infinity) === 0;
    const flowerScale = salt === 1 ? 1 : NEAR_K / FAR_K;
    const { pos, data, slope, ground } = s;
    let live = 0;
    for (let k = 0; k < K; k++) {
      const x = x0 + rng.next() * CELL, z = z0 + rng.next() * CELL;
      const hv = rng.range(0.7, 1.2), yaw = rng.range(0, Math.PI * 2), rnd = rng.next(), f1 = rng.next(), f2 = rng.next(), tv = rng.next(), f3 = rng.next();
      const i = base + k;
      let h = grassBaseHeightAt(x, z, nearTrail ? trailDistance(x, z) : Infinity, nearTrail || edge) * hv;
      if (h > 0.04) for (const tr of trees) { const dx = tr.x - x, dz = tr.z - z; if (dx * dx + dz * dz < (tr.r + 0.35) ** 2) { h = 0; break; } }
      if (h <= 0.04) { data[i * 4] = 0; pos[i * 4 + 1] = -1e4; continue; }
      live++;
      pos[i * 4] = x; pos[i * 4 + 1] = heightAt(x, z) - 0.03; pos[i * 4 + 2] = z; pos[i * 4 + 3] = yaw;
      data[i * 4] = h;
      data[i * 4 + 1] = Math.min(1, Math.max(0, grassToneAt(x, z) + (tv - 0.5) * 0.16));
      const fk = flowerKindAt(x, z, h, f1 / flowerScale, f2);
      // in a drift most flowering clumps carry two heads
      data[i * 4 + 2] = fk > 0 && f3 < 0.6 ? fk + 0.5 : fk;
      data[i * 4 + 3] = rnd;
      slope[i * 2] = sx; slope[i * 2 + 1] = sz;
      groundColorAt(x, z, this.gnd);
      ground[i * 3] = this.gnd[0]; ground[i * 3 + 1] = this.gnd[1]; ground[i * 3 + 2] = this.gnd[2];
    }
    return live;
  }
}
