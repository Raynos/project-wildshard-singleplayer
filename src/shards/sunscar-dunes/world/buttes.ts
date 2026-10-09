import { Box3, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Object3D } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { GROUND_HALF, SEED } from '../data/layout';
import type { DuneHdName } from '../boot/files';
import { Soup, type RGB, type V3 } from './dressing';
import { duneHd } from './meshes';

/**
 * The far sandstone (loop 4; the council's baseline: the other shards layer near / mid / far, ours ended in one flat
 * violet ring): buttes and mesas standing in the dune sea past the playable square, eroded prisms banded in strata
 * over a talus skirt. They sit beyond the painted ground, so the violet distance fog lays them back in layers, and
 * they frame the tower, the caravan and the well's horizons. Out of reach, so no colliders. Loop 7: textured models
 * (below); the prisms here are the fallback, one draw per shape.
 */

/** Strata, bottom to top (linear): rust, pale band, deep red, ochre, a sun-bleached cap. */
const STRATA: readonly RGB[] = [[0.3, 0.11, 0.05], [0.5, 0.24, 0.11], [0.26, 0.09, 0.05], [0.42, 0.18, 0.08], [0.34, 0.13, 0.06], [0.55, 0.3, 0.15]];
const TALUS: RGB = [0.36, 0.15, 0.07], TALUS_FOOT: RGB = [0.44, 0.19, 0.08];

/** One eroded prism, 1 m tall and 1 m in radius at its foot: `sides` facets, `rows` strata, `taper` at the top, a skirt. */
function butteGeometry(seed: number, sides: number, rows: number, taper: number): BufferGeometry {
  const s = new Soup(), rng = new Rng(seed);
  const jag = Array.from({ length: sides }, () => rng.range(0.82, 1.12));
  const ring = (row: number): V3[] => {
    const t = row / rows, y = t, r = 1 - taper * t;
    return jag.map((j, k) => {
      const a = (k / sides) * Math.PI * 2, e = j * (1 + (rng.next() - 0.5) * 0.16) * (row % 2 === 1 ? 0.95 : 1); // each stratum erodes its own way; soft bands undercut
      return [Math.cos(a) * r * e, y, Math.sin(a) * r * e];
    });
  };
  const rings = Array.from({ length: rows + 1 }, (_, i) => ring(i));
  for (let i = 0; i < rows; i++) {
    const lo = rings[i] ?? [], hi = rings[i + 1] ?? [], c = STRATA[i % STRATA.length] ?? TALUS, cHi = STRATA[(i + 1) % STRATA.length] ?? c;
    for (let k = 0; k < sides; k++) {
      const a0 = lo[k] ?? [0, 0, 0], a1 = lo[(k + 1) % sides] ?? a0, b0 = hi[k] ?? a0, b1 = hi[(k + 1) % sides] ?? a0;
      s.tri(a0, b1, a1, c, cHi, c); s.tri(a0, b0, b1, c, cHi, cHi);
    }
  }
  // the cap: a flat, slightly domed top in the bleached stratum
  const top = rings[rows] ?? [], capC = STRATA[STRATA.length - 1] ?? TALUS, mid: V3 = [0, 1 + 0.02, 0];
  for (let k = 0; k < sides; k++) s.tri(top[k] ?? mid, mid, top[(k + 1) % sides] ?? mid, capC);
  // the talus skirt: from a quarter up the wall out and down into the sand (below the ground, so no gap ever shows)
  const foot = rings[0] ?? [], up = Math.max(1, Math.round(rows * 0.25)), shoulder = rings[up] ?? foot;
  for (let k = 0; k < sides; k++) {
    const p0 = shoulder[k] ?? [0, 0, 0], p1 = shoulder[(k + 1) % sides] ?? p0, f0 = foot[k] ?? p0, f1 = foot[(k + 1) % sides] ?? p0;
    const o0: V3 = [f0[0] * 1.7, -0.35, f0[2] * 1.7], o1: V3 = [f1[0] * 1.7, -0.35, f1[2] * 1.7];
    s.tri([p0[0] * 1.04, p0[1], p0[2] * 1.04], o1, [p1[0] * 1.04, p1[1], p1[2] * 1.04], TALUS, TALUS_FOOT, TALUS);
    s.tri([p0[0] * 1.04, p0[1], p0[2] * 1.04], o0, o1, TALUS, TALUS_FOOT, TALUS_FOOT);
  }
  return s.geometry();
}

/** The shapes: a tall narrow butte, a broad flat mesa, a stepped spire. */
const SHAPES = [{ sides: 15, rows: 8, taper: 0.2 }, { sides: 18, rows: 6, taper: 0.1 }, { sides: 12, rows: 9, taper: 0.38 }] as const;

/**
 * Where they stand (metres, x / z), how tall and how wide, and which shape: a loose ring past the painted ground. Loop 7:
 * the first is a broad mesa (the tower deck's and the spawn aerial's centre rock in the mockups h4 / h1-diag-front).
 */
const BUTTES: readonly { x: number; z: number; h: number; r: number; shape: 0 | 1 | 2; yaw: number }[] = [
  { x: -70, z: -330, h: 44, r: 38, shape: 1, yaw: 0.3 }, { x: 95, z: -360, h: 40, r: 48, shape: 1, yaw: 1.1 },
  { x: -190, z: -290, h: 46, r: 38, shape: 1, yaw: 2.0 }, { x: 210, z: -260, h: 64, r: 22, shape: 2, yaw: 0.7 },
  { x: -320, z: -110, h: 52, r: 44, shape: 1, yaw: 0.2 }, { x: -300, z: 60, h: 36, r: 24, shape: 0, yaw: 1.6 },
  { x: -280, z: 210, h: 48, r: 40, shape: 1, yaw: 2.6 }, { x: 320, z: -60, h: 44, r: 30, shape: 0, yaw: 0.9 },
  { x: 300, z: 140, h: 60, r: 46, shape: 1, yaw: 1.9 }, { x: 160, z: 320, h: 38, r: 26, shape: 2, yaw: 0.4 },
  { x: -110, z: 330, h: 50, r: 36, shape: 1, yaw: 2.2 }, { x: 40, z: 380, h: 34, r: 20, shape: 0, yaw: 1.2 },
  { x: -260, z: -200, h: 30, r: 18, shape: 2, yaw: 0.5 }, { x: 250, z: -180, h: 28, r: 34, shape: 1, yaw: 2.9 },
];

/** loop 4: the listed heights × this, so they frame the tower, never rival it. */
const BUTTE_HEIGHT = 0.65;

export interface Buttes { root: Group; count: number }

/**
 * Loop 7 (E374, art/sunscar-dunes/round-18-mesas): the textured models (codex refs → Hunyuan3D-2 → a 1024 WebP map),
 * one per shape: layered red Navajo sandstone with varnish streaks and a talus skirt, toward the mockups' mesas. The
 * procedural prism stays as the fallback for a shape whose model did not load.
 */
const MODEL: Readonly<Record<0 | 1 | 2, DuneHdName>> = { 0: 'mesa-butte', 1: 'mesa-mesa', 2: 'mesa-spire' };
/** A model's footprint (its widest span, the talus skirt included) per metre of a listed foot radius `r`. */
const SPAN_PER_R = 2.6;
/** How far a model's lowest point sits under the sand (metres): the talus foot runs into the dunes, no gap shows. */
const SINK = 4;
/** How far a footprint may stretch or squash against the model's own proportions (texel stretch stays readable). */
const STRETCH = 1.3;
const isMesh = (o: Object3D): o is Mesh => o instanceof Mesh;

/** One textured butte for a listing, or null when its model did not load. */
function butteModel(b: (typeof BUTTES)[number]): Group | null {
  const g = duneHd(MODEL[b.shape], { size: b.h * BUTTE_HEIGHT + SINK, by: 'height', floor: -SINK, yaw: b.yaw });
  if (!g) return null;
  const box = new Box3().setFromObject(g), span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const k = Math.min(STRETCH, Math.max(1 / STRETCH, (b.r * SPAN_PER_R) / Math.max(1e-6, span)));
  g.scale.set(k, 1, k); g.position.set(b.x, 0, b.z);
  g.traverse((o) => {
    if (!isMesh(o)) return;
    o.castShadow = false; o.receiveShadow = false;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m instanceof MeshStandardMaterial) { m.roughness = 0.92; m.metalness = 0; }
  });
  return g;
}

export function buildButtes(): Buttes {
  const root = new Group(), material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, side: DoubleSide });
  // loop 5 (the targets: weathered layered sandstone, not plastic prisms): a rock surface in the shader, in world space
  // (the instances share it): thin wavy strata bands, vertical erosion streaks down the walls, a fine grain, a darker
  // foot where talus and shade gather, and a sun-bleached cap.
  patchShader(material, 'sunscar.butte', PATCH_ORDER.decorate, (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;\nvarying vec3 vRockN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 rockW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nrockW = instanceMatrix * rockW;\n#endif\nvRockPos = (modelMatrix * rockW).xyz;\nvRockN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRockPos;
varying vec3 vRockN;
float rkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rkNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rkHash(i), rkHash(i + vec2(1.0, 0.0)), f.x), mix(rkHash(i + vec2(0.0, 1.0)), rkHash(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float around = atan(vRockPos.z, vRockPos.x) * 120.0;
    float y = vRockPos.y + (rkNoise(vec2(around * 0.08, vRockPos.y * 0.05)) - 0.5) * 2.5;
    float strata = sin(y * 1.35) * 0.5 + sin(y * 3.7 + 1.3) * 0.25 + sin(y * 0.41) * 0.35;
    float streak = rkNoise(vec2(around * 0.9, vRockPos.y * 0.03)) * 0.7 + rkNoise(vec2(around * 3.1, vRockPos.y * 0.09)) * 0.3;
    float grain = rkNoise(vRockPos.xz * 1.7 + vRockPos.y * 0.9) * 0.5 + rkNoise(vRockPos.xy * 4.3) * 0.5;
    float wall = 1.0 - abs(normalize(vRockN).y);
    diffuseColor.rgb *= 1.0 + 0.16 * strata * wall + (streak - 0.5) * 0.36 * wall + (grain - 0.5) * 0.22;
    diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(-6.0, 6.0, vRockPos.y));
  }`);
  }, {});
  const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), sc = new Vector3(), up = new Vector3(0, 1, 0);
  SHAPES.forEach((shape, i) => {
    const list = BUTTES.filter((b) => b.shape === i && Math.max(Math.abs(b.x), Math.abs(b.z)) > GROUND_HALF);
    if (list.length === 0) return;
    const models = list.map(butteModel);
    if (models.every((g) => g !== null)) { for (const g of models) root.add(g); return; }
    const mesh = new InstancedMesh(butteGeometry(SEED + 300 + i, shape.sides, shape.rows, shape.taper), material, list.length);
    list.forEach((b, k) => { q.setFromAxisAngle(up, b.yaw); m.compose(p.set(b.x, -6, b.z), q, sc.set(b.r, b.h * BUTTE_HEIGHT, b.r)); mesh.setMatrixAt(k, m); });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.castShadow = false; mesh.receiveShadow = false;
    root.add(mesh);
  });
  return { root, count: BUTTES.length };
}
