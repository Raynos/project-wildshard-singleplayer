/**
 * The snow ring's crag rock (E306 / E315 second pass; the pieces and their material were src/shards/nalati-grasslands/cragRock.ts, the
 * crags pass): real faceted granite the terrain's 2 m grid cannot carry, in three kinds —
 *
 *   fin      a blade-like tower standing ON a crest, long axis along the ridge (the serrated skyline), 5–18 m tall
 *   rib      a buttress standing AGAINST a steep face, long axis down the fall line, its top slanting with the face
 *   tower    a squat broken tower on a steep shoulder, where the crags rise out of the scree
 *
 * Every piece is a stack of jittered polygon rings (5–7 sides) tapering to a split crown, with a stepped ledge or two
 * (the strata — snow lies on them), flat-shaded, drawn from its placer's rng stream (so the ring is bit-identical). On
 * one painterly material that paints them like the terrain's granite: the painted rock texture triplanar in world
 * space, vertical fractures and strata bands, snow on every face that looks up above the snow line, blue in the shade.
 * src/shards/nalati-grasslands/cragRock.ts places ~500 over the snow ring, merged into four quadrant meshes (drawnInto them); each
 * collides as the hull of what it draws.
 */
import * as THREE from 'three';
import { loadNalatiTextures, TEX_METRES, TEX_MEAN, isPhoneTier } from '../look/nalatiTextures';
import { SNOW_LINE } from '../layout';
import { Rng } from '@wildshard/engine/core/rng';
import { defineModel } from '@wildshard/engine/models/model';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

// ── the rock pieces ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One piece: `w` wide (local x), `d` deep (local z), `h` tall, standing on y = 0. Rings of `sides` jittered points
 * taper toward a crown split into 1–3 teeth; `ledges` rings step inward (a flat tread). `lean` tips the stack along x.
 */
export function piece(rng: Rng, w: number, d: number, h: number, sides: number, ledges: number, lean: number, narrow = 0.55, toothH = 0.12): THREE.BufferGeometry {
  const rings: { y: number; pts: [number, number][] }[] = [];
  const levels = Math.max(3, Math.round(h / 3.2));
  const ledgeAt = new Set<number>();
  for (let i = 0; i < ledges; i++) ledgeAt.add(rng.int(1, levels - 2));
  const phase = rng.range(0, Math.PI * 2);
  const radii = Array.from({ length: sides }, () => rng.range(0.72, 1.12));
  let ox = 0, oz = 0, taper = 1;
  for (let k = 0; k <= levels; k++) {
    const t = k / levels;
    const y = t * h * (k === 0 ? 1 : rng.range(0.94, 1.04));
    taper = Math.max(0.12, (1 - t ** 1.25 * narrow) * (k > 0 ? rng.range(0.9, 1.04) : 1));
    ox += lean * (h / levels) + rng.range(-0.12, 0.12) * w * 0.1;
    oz += rng.range(-0.12, 0.12) * d * 0.1;
    const ring = (s: number): [number, number][] => radii.map((r, i) => {
      const a = phase + (i / sides) * Math.PI * 2 + rng.range(-0.18, 0.18);
      const rr = r * s * rng.range(0.9, 1.08);
      return [ox + Math.cos(a) * (w / 2) * rr, oz + Math.sin(a) * (d / 2) * rr];
    });
    rings.push({ y: Math.min(y, h), pts: ring(taper) });
    // a stratum: the stack steps in, leaving a flat tread for the snow
    if (ledgeAt.has(k) && k < levels) rings.push({ y: Math.min(y, h) + 0.05, pts: ring(taper * rng.range(0.7, 0.82)) });
  }
  const pos: number[] = [];
  const tri = (a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple): void => { pos.push(...a, ...b, ...c); };
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k], B = rings[k + 1];
    if (!A || !B) continue;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a0 = A.pts[i], a1 = A.pts[j], b0 = B.pts[i], b1 = B.pts[j];
      if (!a0 || !a1 || !b0 || !b1) continue;
      tri([a0[0], A.y, a0[1]], [b0[0], B.y, b0[1]], [a1[0], A.y, a1[1]]);
      tri([a1[0], A.y, a1[1]], [b0[0], B.y, b0[1]], [b1[0], B.y, b1[1]]);
    }
  }
  // the crown: 1–3 teeth along the long axis, each a point over a slice of the top ring
  const top = rings[rings.length - 1];
  if (top) {
    const teeth = w > d * 1.6 ? rng.int(2, 3) : rng.int(1, 2);
    const cx = top.pts.reduce((s, p) => s + p[0], 0) / sides, cz = top.pts.reduce((s, p) => s + p[1], 0) / sides;
    const peaks: THREE.Vector3Tuple[] = [];
    for (let t = 0; t < teeth; t++) {
      const u = teeth === 1 ? 0 : (t / (teeth - 1) - 0.5) * 0.9;
      peaks.push([cx + u * w * taper, top.y + rng.range(0.3, 1) * Math.min(h, 12) * toothH * (1 - Math.abs(u) * 0.6), cz + rng.range(-0.1, 0.1) * d * taper]);
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const p0 = top.pts[i], p1 = top.pts[j];
      if (!p0 || !p1) continue;
      // the tooth nearest this edge's midpoint along x
      const mx = (p0[0] + p1[0]) / 2;
      let best = peaks[0];
      for (const p of peaks) if (best && Math.abs(p[0] - mx) < Math.abs(best[0] - mx)) best = p;
      if (best) tri([p0[0], top.y, p0[1]], best, [p1[0], top.y, p1[1]]);
    }
    // the gaps between the teeth
    for (let t = 0; t + 1 < peaks.length; t++) {
      const a = peaks[t], b = peaks[t + 1];
      if (!a || !b) continue;
      const lowY = top.y + 0.05;
      tri(a, [(a[0] + b[0]) / 2, lowY, cz + d * taper * 0.4], b);
      tri(b, [(a[0] + b[0]) / 2, lowY, cz - d * taper * 0.4], a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non-indexed: flat facets
  return g;
}

// ── the material: the terrain's granite (src/shards/nalati-grasslands/terrainSurface.ts cragRock), snow on what looks up ──────────

const CRAG_FRAG_PARS = /* glsl */`
uniform sampler2D tCragRock; uniform sampler2D tCragSnow;
uniform vec3 uCragRockMean; uniform vec2 uCragScale; // 1 / metres: rock, snow
varying vec3 vCragW; varying vec3 vCragN;
float cHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float cNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( cHash( i ), cHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( cHash( i + vec2( 0.0, 1.0 ) ), cHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
`;
const cragFragMain = (phone: boolean): string => /* glsl */`
#include <color_fragment>
{
  vec3 N = normalize( vCragN ), p = vCragW;
  vec3 w = pow( abs( N ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z );
  float s = uCragScale.x;
  vec3 r = ( texture2D( tCragRock, p.zy * s ).rgb * w.x + texture2D( tCragRock, p.xz * s ).rgb * w.y + texture2D( tCragRock, p.xy * s ).rgb * w.z ) / uCragRockMean;
  ${phone ? '' : `vec2 st = vec2( 1.0, 0.45 ) * s * 0.21;
  r *= mix( vec3( 1.0 ), ( texture2D( tCragRock, p.zy * st ).rgb * w.x + texture2D( tCragRock, p.xz * s * 0.21 ).rgb * w.y + texture2D( tCragRock, p.xy * st ).rgb * w.z ) / uCragRockMean, 0.6 );`}
  float u = mix( p.x, p.z, w.x / max( w.x + w.z, 1e-3 ) );
  r *= mix( 0.55, 1.0, smoothstep( 0.0, 0.07, abs( cNoise( vec2( u * 0.16, p.y * 0.018 ) ) - 0.5 ) ) );
  r *= mix( 0.8, 1.12, cNoise( vec2( u * 0.012, p.y * 0.11 + cNoise( p.xz * 0.02 ) * 2.0 ) ) );
  vec3 g = diffuseColor.rgb * r * vec3( 0.34, 0.35, 0.39 ) / 0.36;
  // snow on every face that looks up, above the (ragged) snow line; blue in the shade
  float brk = cNoise( p.xz * 0.35 + p.y * 0.2 ) - 0.5;
  float hiK = smoothstep( 44.0, 84.0, p.y );
  float sn = smoothstep( 0.55 - hiK * 0.33, 0.75 - hiK * 0.33, N.y + brk * 0.3 ) * smoothstep( ${(SNOW_LINE - 14).toFixed(1)}, ${(SNOW_LINE - 2).toFixed(1)}, p.y + brk * 10.0 );
  // high up the snow also streaks down the steep faces' gullies (the round-8 peaks read white, ribbed with rock)
  sn = max( sn, smoothstep( 0.46, 0.6, cNoise( vec2( u * 0.07, p.y * 0.012 ) ) + brk * 0.25 + hiK * 0.12 ) * hiK * smoothstep( -0.3, 0.05, N.y ) * 0.94 );
  vec3 snow = texture2D( tCragSnow, p.xz * uCragScale.y ).rgb * vec3( 0.97, 1.0, 1.05 );
  snow *= mix( vec3( 0.84, 0.91, 1.08 ), vec3( 1.05, 1.02, 0.97 ), smoothstep( -0.05, 0.45, dot( N, normalize( uPSunDir ) ) ) );
  diffuseColor.rgb = mix( g, snow, sn );
}
`;

export function cragMaterial(sky: Sky): THREE.MeshLambertMaterial {
  const mat = painterlyMaterial(sky, { vertexColors: true, rim: 0.3, bands: 0.8 });
  const white = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1);
  white.colorSpace = THREE.SRGBColorSpace; white.wrapS = white.wrapT = THREE.RepeatWrapping; white.needsUpdate = true;
  const uniforms = {
    tCragRock: { value: white as THREE.Texture }, tCragSnow: { value: white as THREE.Texture },
    uCragRockMean: { value: new THREE.Vector3(...TEX_MEAN.rock) },
    uCragScale: { value: new THREE.Vector2(1 / TEX_METRES.rock, 1 / TEX_METRES.snow) },
  };
  loadNalatiTextures(['rock', 'snow']).then((t) => { uniforms.tCragRock.value = t.rock; uniforms.tCragSnow.value = t.snow; return t; }).catch(() => null);
  const phone = isPhoneTier();
  patchShader(mat, 'nalati.crag-rock', PATCH_ORDER.decorate, (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCragW; varying vec3 vCragN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCragW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvCragN = normalize( mat3( modelMatrix ) * objectNormal );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CRAG_FRAG_PARS}`)
      .replace('#include <color_fragment>', cragFragMain(phone));
  }, { key: `nalati-crag-rock${phone ? '-phone' : ''}` });
  return mat;
}

// ── the three kinds: each draws its shape's choices from the stream, then the piece ───────────────────────────────

/** a fin on a crest: a broad castellated tower, `w` along the ridge */
export function finGeometry(rng: Rng, w: number, d: number, h: number): THREE.BufferGeometry {
  return piece(rng, w, d, h, rng.int(5, 7), rng.int(1, 2), rng.range(-0.05, 0.05), 0.42, 0.18);
}

/** a rib against a steep face: `len` down the fall line, its top slanting down it with the face (`grad`: rise per metre) */
export function ribGeometry(rng: Rng, thick: number, len: number, h: number, grad: number): THREE.BufferGeometry {
  const rib = piece(rng, thick, len, h, rng.int(5, 6), rng.int(1, 2), 0, 0.3, 0.08);
  rib.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, -grad * 0.55, 0, 0, 0, 1, 0, 0, 0, 0, 1));
  rib.computeVertexNormals();
  return rib;
}

/** a broken tower on a steep shoulder, `sz` across */
export function towerGeometry(rng: Rng, sz: number, h: number): THREE.BufferGeometry {
  return piece(rng, sz, sz * rng.range(0.6, 0.9), h, rng.int(5, 7), rng.int(1, 2), rng.range(-0.04, 0.04), 0.35, 0.15);
}

export type CragKind = 'fin' | 'rib' | 'tower';

/** one of each for the Explorer: a mid-size piece in the rock's own grey */
function specimen(kind: CragKind): THREE.BufferGeometry {
  const rng = new Rng(0xc4a9);
  const g = kind === 'fin' ? finGeometry(rng, 10, 5.5, 14) : kind === 'rib' ? ribGeometry(rng, 5, 8, 12, 1) : towerGeometry(rng, 6, 9);
  const n = g.getAttribute('position').count, cols = new Float32Array(n * 3).fill(0.35);
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

export const cragRock = defineModel<{ readonly kind: CragKind }>({
  id: 'nalati-grasslands/crag-rock', name: 'Crag rock', category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/cragRock.ts', surface: 'rock',
  defaults: { kind: 'fin' },
  variants: [{ id: 'fin', label: 'Fin', params: {} }, { id: 'rib', label: 'Rib', params: { kind: 'rib' } }, { id: 'tower', label: 'Tower', params: { kind: 'tower' } }],
  build: (ctx, p) => [{ geometry: specimen(p.kind), material: ctx.once('nalati-crag-rock', () => cragMaterial(ctx.sky)), castShadow: true, receiveShadow: true }],
});
