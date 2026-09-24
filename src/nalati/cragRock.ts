/**
 * The snow ring's crag rock (layout v2, docs/design/nalati/layout-v2.md; the crags pass): the terrain gives the massifs
 * their arêtes, couloirs and strata (the chunk def's `crags`), this gives them a jagged silhouette and vertical faces
 * a 2 m height grid cannot carry — real faceted granite, not cards:
 *
 *   fins     blade-like towers standing ON the crests, long axis along the ridge (a serrated skyline from the bowl, the
 *            valley and the air), 5–18 m tall, sunk well into the ridge so no base shows
 *   ribs     buttresses standing AGAINST the steepest faces and the valley walls, long axis down the fall line, their
 *            tops just proud of the slope above — vertical walls with deep shadowed clefts between them
 *   blocks   squat broken towers on the steep shoulders lower down, where the crags rise out of the scree
 *
 * Every piece is a stack of jittered polygon rings (5–7 sides) tapering to a split crown, with a stepped ledge or two
 * (the strata — snow lies on them), flat-shaded. Merged into four meshes (one per quadrant of the ring, so the frustum
 * culls what is behind you) on one painterly material that paints them like the terrain's granite: the painted rock
 * texture triplanar in world space, vertical fractures and strata bands, snow on every face that looks up above the
 * snow line, blue in the shade. Placed from the terrain alone (seeded, deterministic): off the roads, the stream, the
 * POI clearings, the glacier and the ledges' spots.
 *
 *   const crags = buildCragRock(sky);   scene.add(crags.group);   player.colliders.push(...crags.colliders);
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import { Noise2D, smoothstep } from '../core/noise';
import { heightAt, trailDistance } from '../world/Heightfield';
import { inPoiClearing } from '../world/nalati/clearings';
import { painterlyMaterial } from '../world/painterly';
import { loadNalatiTextures, TEX_METRES, TEX_MEAN, isPhoneTier } from '../world/nalatiTextures';
import { zoneAt, glacierMask, brookMask, SNOW_LINE, LEOPARD_CAVE, ARGYMAQ_PASTURE, SNOW_LOTUS, WATCHTOWER } from '../chunks/nalati-grasslands';
import type { Collider } from '../player/Player';
import type { Sky } from '../world/Sky';

export interface CragRock { group: THREE.Group; colliders: Collider[]; count: { fins: number; ribs: number; blocks: number }; triangles: number }

// ── the rock pieces ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One piece: `w` wide (local x), `d` deep (local z), `h` tall, standing on y = 0. Rings of `sides` jittered points
 * taper toward a crown split into 1–3 teeth; `ledges` rings step inward (a flat tread). `lean` tips the stack along x.
 */
function piece(rng: Rng, w: number, d: number, h: number, sides: number, ledges: number, lean: number, narrow = 0.55, toothH = 0.12): THREE.BufferGeometry {
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

// ── the material: the terrain's granite (src/nalati/terrainSurface.ts cragRock), snow on what looks up ──────────

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

function cragMaterial(sky: Sky): THREE.MeshLambertMaterial {
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
  const base = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCragW; varying vec3 vCragN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCragW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvCragN = normalize( mat3( modelMatrix ) * objectNormal );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CRAG_FRAG_PARS}`)
      .replace('#include <color_fragment>', cragFragMain(phone));
  };
  mat.customProgramCacheKey = () => `nalati-crag-rock${phone ? '-phone' : ''}`;
  return mat;
}

// ── placement ───────────────────────────────────────────────────────────────────────────────────────────────────

const RING = 7; // the crest test's radius (m)

export function buildCragRock(sky: Sky, seed = 0xc4a9): CragRock {
  const rng = new Rng(seed), jitter = new Noise2D(seed + 3);
  const colliders: Collider[] = [];
  const count = { fins: 0, ribs: 0, blocks: 0 };
  // four quadrant buckets (east / west × north / south of z = −110), each one mesh
  const parts: THREE.BufferGeometry[][] = [[], [], [], []];
  const occ = new Map<number, { x: number; z: number; r: number }[]>();
  const key = (x: number, z: number): number => (Math.floor(x / 12) + 64) * 1024 + Math.floor(z / 12) + 64;
  const free = (x: number, z: number, r: number): boolean => {
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of occ.get(key(x + a * 12, z + b * 12)) ?? []) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
    return true;
  };
  const claim = (x: number, z: number, r: number): void => { const k = key(x, z); const l = occ.get(k) ?? []; l.push({ x, z, r }); occ.set(k, l); };
  // keep-outs: the cave, Argymaq's bench, the snow lotus, the watchtower's rock (their own agents dress them)
  const keepOut: [number, number, number][] = [[LEOPARD_CAVE.x, LEOPARD_CAVE.z, 22], [ARGYMAQ_PASTURE.x, ARGYMAQ_PASTURE.z, 34], [WATCHTOWER.x, WATCHTOWER.z, 22], ...SNOW_LOTUS.map((l): [number, number, number] => [l.x, l.z, l.r + 6])];
  const blocked = (x: number, z: number, r: number): boolean =>
    Math.abs(x) > 246 || Math.abs(z) > 246 || trailDistance(x, z) < 9 + r || inPoiClearing(x, z, 4 + r) || glacierMask(x, z) > 0.02 || brookMask(x, z) > 0 ||
    keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + r);
  const col = (): THREE.Color => new THREE.Color().setScalar(rng.range(0.3, 0.4)).offsetHSL(0, 0, 0).add(new THREE.Color(0, 0.004, 0.02));

  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, yaw: number, pitch: number, roll: number): void => {
    const c = col();
    const n = g.getAttribute('position').count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    parts[(x < 0 ? 0 : 1) + (z < -110 ? 2 : 0)]?.push(g);
  };
  const lowest = (x: number, z: number, r: number): number => {
    let lo = heightAt(x, z);
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; lo = Math.min(lo, heightAt(x + Math.cos(t) * r, z + Math.sin(t) * r)); }
    return lo;
  };

  const phone = isPhoneTier();
  const step = 4.5;
  for (let gx = -246; gx <= 246; gx += step) for (let gz = -246; gz <= 60; gz += step) {
    const x = gx + rng.range(-step * 0.45, step * 0.45), z = gz + rng.range(-step * 0.45, step * 0.45);
    const roll = rng.next();
    const zs = zoneAt(x, z)[2];
    if (zs < 0.55) continue;
    const h = heightAt(x, z);
    if (h < 6) continue;
    // the local shape: the mean of a ring round the point (a crest stands above it), the gradient
    let sum = 0, bestPair = -Infinity, ridgeYaw = 0;
    const around: number[] = [];
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; const v = heightAt(x + Math.cos(t) * RING, z + Math.sin(t) * RING); around.push(v); sum += v; }
    for (let k = 0; k < 4; k++) { const pair = (around[k] ?? 0) + (around[k + 4] ?? 0); if (pair > bestPair) { bestPair = pair; ridgeYaw = -(k / 8) * Math.PI * 2; } }
    const crest = h - sum / 8;
    const gxh = heightAt(x + 1.5, z) - heightAt(x - 1.5, z), gzh = heightAt(x, z + 1.5) - heightAt(x, z - 1.5);
    const grad = Math.hypot(gxh, gzh) / 3; // rise per metre
    const downYaw = Math.atan2(-gxh, -gzh); // three.js yaw whose local +z points downhill … (sin, cos) of the fall line
    const dens = 0.55 + 0.45 * smoothstep(-0.3, 0.4, jitter.fbm(x * 0.02, z * 0.02, 2));

    const band = smoothstep(-0.1, 0.35, jitter.fbm(x * 0.017 + 9, z * 0.017 - 5, 3)); // where the cliff bands run

    if (crest > 1.6 && h > 46 && roll < 0.2 * dens * (phone ? 0.75 : 1)) {
      // ── a fin on the crest: a broad castellated tower, long axis along the ridge ──
      const hh = rng.range(3, 6) + smoothstep(50, 110, h) * rng.range(2, 6) + Math.min(4, crest * 0.5);
      const w = rng.range(7, 14), d = rng.range(4, 7.5);
      if (blocked(x, z, w * 0.5) || !free(x, z, w * 0.42)) continue;
      claim(x, z, w * 0.42);
      const base = lowest(x, z, w * 0.4) - 1.2;
      add(piece(rng, w, d, hh + (h - base), rng.int(5, 7), rng.int(1, 2), rng.range(-0.05, 0.05), 0.42, 0.18), x, base, z, ridgeYaw + rng.range(-0.2, 0.2), rng.range(-0.05, 0.05), rng.range(-0.06, 0.06));
      count.fins++;
    } else if (grad > 0.8 && roll < (0.15 + 0.85 * band) * 0.65 * (phone ? 0.75 : 1)) {
      // ── a rib against a steep face (≥ ~39°), long axis down the fall line, its top just proud of the slope above: side
      //    by side where a cliff band runs they make one vertical wall with clefts between the buttresses ──
      const len = rng.range(5, 10), thick = rng.range(3.5, 6.5);
      if (blocked(x, z, thick * 0.6) || !free(x, z, thick * 0.42)) continue;
      claim(x, z, thick * 0.42);
      const ux = x - Math.sin(downYaw) * len * 0.45, uz = z - Math.cos(downYaw) * len * 0.45;
      const topY = heightAt(ux, uz) + rng.range(0.3, 1.8) + band * 1.2;
      const base = lowest(x, z, len * 0.5) - 1.5;
      if (topY - base < 4) continue;
      // its top slants down the fall line with the face (a rib, not a flat-topped block), the downhill end still a
      // sheer drop
      const rib = piece(rng, thick, len, topY - base, rng.int(5, 6), rng.int(1, 2), 0, 0.3, 0.08);
      rib.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, -grad * 0.55, 0, 0, 0, 1, 0, 0, 0, 0, 1));
      rib.computeVertexNormals();
      add(rib, x, base, z, downYaw + rng.range(-0.12, 0.12), 0, 0);
      count.ribs++;
    } else if (grad > 0.5 && grad <= 0.8 && h > 32 && roll > 0.95 - 0.04 * dens) {
      // ── a broken tower on a steep shoulder ──
      const sz = rng.range(4, 8);
      if (blocked(x, z, sz * 0.6) || !free(x, z, sz * 0.6)) continue;
      claim(x, z, sz * 0.6);
      const base = lowest(x, z, sz * 0.5) - 1;
      const top = h + rng.range(2.5, 6);
      add(piece(rng, sz, sz * rng.range(0.6, 0.9), top - base, rng.int(5, 7), rng.int(1, 2), rng.range(-0.04, 0.04), 0.35, 0.15), x, base, z, rng.range(0, Math.PI * 2), 0, 0);
      if (grad < 0.7) colliders.push({ x, z, hw: sz * 0.4, hd: sz * 0.3, rot: 0, yBottom: base, yTop: top });
      count.blocks++;
    }
  }

  const group = new THREE.Group();
  group.name = 'nalati-crag-rock';
  const mat = cragMaterial(sky);
  let triangles = 0;
  parts.forEach((list, i) => {
    if (list.length === 0) return;
    const geo = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    triangles += geo.getAttribute('position').count / 3;
    const m = new THREE.Mesh(geo, mat);
    m.name = `nalati-crag-rock-${i}`;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  });
  return { group, colliders, count, triangles: Math.round(triangles) };
}
