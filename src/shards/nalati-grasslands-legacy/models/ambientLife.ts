/**
 * Nalati's ambient life as models (E348, the E315 M5 leftover): the butterflies over the flower drifts and the raptors
 * circling high over the valley — creatures with no species rig, drawn and flown by the dressing's live system
 * (src/shards/nalati-grasslands/world/dressing/life.ts, `DressLife`: one instanced draw each, CPU-flapped every frame). Their geometry is
 * built here, by the builders the live system draws with (`wingGeo`, `halfBirdGeo`, moved here unchanged), so each card
 * is the same wing on the same painterly material: two instances, the right half and the mirrored left, as the world
 * draws a copy, posed mid-beat. Nothing the Explorer does reaches the live flocks.
 */
import * as THREE from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { defineModel, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';

const FILE = 'src/shards/nalati-grasslands/models/ambientLife.ts';

/** how many butterflies the dressing flies (phone / desktop) and raptors it circles */
export const BUTTERFLIES = TIER === 'phone' ? 14 : 30;
export const RAPTORS = 3;
/** the wing scale (NALATI-FINISH B2 / E302: the bigger ones picked, 2026-09-30 — they were 1.7) */
export const FLY_SCALE = 2.8;
/** the butterflies' colours, one per copy in turn (the instance colour tints the wing's painted shading) */
export const BUTTERFLY_HUES = ['#f08a2a', '#f4f1e2', '#7fa0f0', '#f2d23c', '#f4f1e2', '#e9702a'];

/** a butterfly wing: a fore + hind wing fan hinged on +x from the body line (x = 0), two-sided, painted */
export function wingGeo(): THREE.BufferGeometry {
  const v = [0, 0, 0.004, 0.034, 0.004, 0.02, 0.044, 0, -0.004, 0.03, 0, -0.026, 0, 0, -0.012];
  const idx = [0, 1, 2, 0, 2, 3, 0, 3, 4];
  const back = [0, 2, 1, 0, 3, 2, 0, 4, 3];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  // dark at the hinge, the colour in the middle, dark wingtips (the instance colour tints it)
  g.setAttribute('color', new THREE.Float32BufferAttribute([0.15, 0.12, 0.1, 0.6, 0.55, 0.5, 0.9, 0.88, 0.85, 0.75, 0.72, 0.7, 0.2, 0.18, 0.16], 3));
  g.setIndex([...idx, ...back]);
  g.computeBoundingSphere();
  return g;
}

/** half a raptor (its right side): half the body, one long fingered wing on +x, half the tail; mirrored for the left */
export function halfBirdGeo(): THREE.BufferGeometry {
  // (x, y, z) with −z forward; wing chord ~0.45 at the root, tapering to fingers at 1.0 m
  const v: number[] = [
    0, 0.02, -0.55, 0.07, 0, -0.35, 0.09, 0.0, 0.05, 0, 0.04, 0.2, 0, -0.05, -0.1,  // body: beak, shoulder, hip, back, belly (0-4)
    0.07, 0.0, -0.22, 0.45, 0.03, -0.2, 0.85, 0.06, -0.12, 1.0, 0.07, 0.0, 0.8, 0.05, 0.12, 0.4, 0.02, 0.2, 0.08, 0.0, 0.15, // wing (5-11)
    0, 0.02, 0.3, 0.13, 0.02, 0.55, 0, 0.02, 0.6, // tail (12-14)
  ];
  const tri = [
    0, 1, 3, 1, 2, 3, 0, 4, 1, 1, 4, 2,          // body top + belly
    5, 6, 11, 6, 10, 11, 6, 7, 10, 7, 9, 10, 7, 8, 9, // wing
    12, 13, 14,                                  // tail
  ];
  const back: number[] = [];
  for (let i = 0; i < tri.length; i += 3) back.push(tri[i] ?? 0, tri[i + 2] ?? 0, tri[i + 1] ?? 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([...tri, ...back]);
  g.computeVertexNormals();
  const n = v.length / 3, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = v[i * 3] ?? 0, z = v[i * 3 + 2] ?? 0;
    // rufous body, darker wing, black fingertips, a pale band under the hand
    let r = 0.36, gg = 0.22, b = 0.12;
    if (x > 0.3) { r = 0.22; gg = 0.15; b = 0.1; }
    if (x > 0.8) { r = 0.06; gg = 0.05; b = 0.05; }
    if (z > 0.5) { r = 0.42; gg = 0.28; b = 0.16; }
    col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

/**
 * One copy as the dressing draws it: two instances of `half` — the right half turned up by `ang` about the body line,
 * the left the same mirrored (scale −1 in x) — under the body's pose, tinted `tint`.
 */
function pair(ctx: ModelContext, key: string, half: () => THREE.BufferGeometry, material: () => THREE.Material, body: THREE.Matrix4, ang: number, tint: THREE.Color): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(ctx.once(`${key}:geo`, half), ctx.once(`${key}:mat`, material), 2);
  const turn = new THREE.Matrix4();
  im.setMatrixAt(0, new THREE.Matrix4().multiplyMatrices(body, turn.makeRotationZ(ang)));
  turn.makeRotationZ(-ang).premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  im.setMatrixAt(1, new THREE.Matrix4().multiplyMatrices(body, turn));
  im.setColorAt(0, tint); im.setColorAt(1, tint);
  im.computeBoundingBox(); im.computeBoundingSphere();
  im.castShadow = true;
  return im;
}

export interface ButterflyParams { readonly hue: string }

/** The butterfly: two painted wing fans on a body line, 25 cm across; its colours are the dressing's (orange, cream, blue, gold, rust). */
export const butterfly: ModelDef<ButterflyParams> = defineModel<ButterflyParams>({
  id: 'nalati-grasslands/butterfly', name: 'Butterfly', category: 'creatures', pipeline: 'code', file: FILE, surface: 'flesh',
  defaults: { hue: BUTTERFLY_HUES[0] ?? '#f08a2a' },
  variants: [
    { id: 'orange', label: 'Orange', params: { hue: '#f08a2a' } }, { id: 'cream', label: 'Cream', params: { hue: '#f4f1e2' } },
    { id: 'blue', label: 'Blue', params: { hue: '#7fa0f0' } }, { id: 'gold', label: 'Gold', params: { hue: '#f2d23c' } },
    { id: 'rust', label: 'Rust', params: { hue: '#e9702a' } },
  ],
  build: (ctx, p) => {
    // DressLife.updateFlies' pose: pitched −0.25, the wings near the top of a beat (open to the camera, not edge-on)
    const body = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.25, 0, 0, 'YXZ')), new THREE.Vector3().setScalar(FLY_SCALE));
    return pair(ctx, 'nalati:butterfly', wingGeo, () => painterlyMaterial(ctx.sky, { rim: 0.3, bands: 0.5, shade: 0.6, emissive: 0x101010 }), body, 1.0, new THREE.Color(p.hue));
  },
});

export interface RaptorParams { readonly scale: number }

/** The raptor: a steppe kite / eagle on long fingered wings, rufous with black fingertips, gliding with its wings bent up a little. */
export const raptor: ModelDef<RaptorParams> = defineModel<RaptorParams>({
  id: 'nalati-grasslands/raptor', name: 'Raptor', category: 'creatures', pipeline: 'code', file: FILE, surface: 'flesh',
  defaults: { scale: 1.3 },
  variants: [{ id: 'kite', label: 'Kite', params: { scale: 1.3 } }, { id: 'eagle', label: 'Eagle', params: { scale: 1.7 } }],
  build: (ctx, p) => {
    // DressLife.updateBirds' turn: nose up 0.05, banked 0.32 into the circle, the wings on a flap burst's up-stroke
    const body = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, 0.32, 'YXZ')), new THREE.Vector3().setScalar(p.scale));
    return pair(ctx, 'nalati:raptor', halfBirdGeo, () => painterlyMaterial(ctx.sky, { rim: 0.6, bands: 0.6 }), body, 0.4, new THREE.Color(1, 1, 1));
  },
});
