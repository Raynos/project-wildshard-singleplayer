/**
 * The balbal (E306 / E315 M3): a Turkic stone warrior (6th–8th c. kurgan stele, the Xiaohongnahai stone man) — a
 * granite pillar carved into a man holding a cup to his chest with the right hand, the left on a sabre hilt at the belt,
 * a heavy brow, a drooping moustache, lichen on the weathered tops. Two on each small kurgan's crown
 * (src/shards/nalati-grasslands/world/Balbals.ts); B11 wakes them at dusk.
 *
 * What ships is the TRELLIS.2 model (`balbal.glb`, scripts/img2mesh/props/nalati.json), turned to face −z and scaled
 * to the carved stele's 2.15 m. The two carved code variants (bare-headed, a pointed cap and beard) are drawn until the
 * file lands and are the Explorer's other two variants. Placed instanced: one InstancedMesh per carved variant, both
 * wearing the generated model once it has loaded (`wearGenerated`). Its collision is the statues' own (Balbals.register:
 * each a box that stops colliding while that warrior is awake).
 *
 * `balbalGeometry(variant)` (feet at y 0, facing −z, 2.1 m) is B11's rig's body too.
 */
import * as THREE from 'three';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { Noise2D } from '@wildshard/engine/core/noise';
import { defineModel } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { PaintKit, v3, poiMaterial } from '../world/paint';
import { pole, mergeVerticesByPos } from '@wildshard/engine/world/geometryKit';
import { loadNalatiModel, MODEL_SIZE } from '../world/glbPaint';

export type BalbalCarving = 'bare' | 'capped';

export interface BalbalParams {
  /** a carved code stele, or null: the generated (TRELLIS.2) model */
  readonly carved: BalbalCarving | null;
}

const C = {
  stone: new THREE.Color('#9a9386'),
  stoneWarm: new THREE.Color('#a69a88'),
  carve: new THREE.Color('#5d5a54'),
  lichenGold: new THREE.Color('#b8a266'),
  lichenGreen: new THREE.Color('#98a07e'),
};

const lichen = new Noise2D(0xba1b);
/** granite with carved-groove darkening supplied by the caller, plus lichen blotches from 3D-ish noise */
function stonePainter(base: THREE.Color): (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color {
  const out = new THREE.Color();
  return (p, n) => {
    out.copy(base);
    const b = lichen.get(p.x * 4.1 + p.y * 1.7, p.z * 4.3 - p.y * 2.3) * 0.6 + lichen.get(p.x * 11 + p.y * 5, p.z * 11) * 0.4;
    if (b > 0.36) out.lerp(p.y > 1.0 || n.y > 0.3 ? C.lichenGold : C.lichenGreen, Math.min(0.5, (b - 0.36) * 2.5));
    if (n.y < -0.4) out.multiplyScalar(0.8);
    return out;
  };
}

/** a stone part: welded, its surface chipped and weathered by noise (amp in metres), smooth-shaded */
function weathered(g: THREE.BufferGeometry, amp: number, seed: number): THREE.BufferGeometry {
  const w = mergeVerticesByPos(g);
  const n = new Noise2D(seed);
  const pos = w.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, z) || 1;
    const k = (n.get(x * 7 + y * 3, z * 7 - y * 2) * 0.6 + n.get(x * 17 + 3, y * 17 + z * 5) * 0.4) * amp;
    pos.setXYZ(i, x + (x / len) * k, y + k * 0.3, z + (z / len) * k);
  }
  w.computeVertexNormals();
  return w;
}

/**
 * A carved balbal in local space: feet at y 0, facing −z, ~2.15 m tall. A squat, heavy stele — the Turkic kurgan
 * warrior: a big head with a heavy brow, deep-set almond eyes, a long wedge nose and a thick moustache curling down past
 * the mouth; the right hand raises a goblet to the chest, the left rests on the sabre at the belt; belt pendants; the
 * stone chipped and weathered, lichen gold on the tops. Variant 1 wears a pointed cap and a short beard.
 */
export function balbalGeometry(variant: number, seed = 0xba1): THREE.BufferGeometry {
  const kit = new PaintKit(seed + variant * 17);
  const stone = variant === 0 ? C.stone : C.stoneWarm;
  const paint = stonePainter(stone);
  const carve = stonePainter(C.carve);
  const add = (g: THREE.BufferGeometry, c: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) => kit.add(g, c, { brush: 0.1 });
  const s0 = seed + variant * 101;
  // plinth (half buried) and the body: a broad flattened pillar, tapering a little, weathered
  add(weathered(new THREE.CylinderGeometry(0.46, 0.52, 0.5, 12, 2).scale(1, 1, 0.78), 0.05, s0), paint);
  add(weathered(new THREE.CylinderGeometry(0.35, 0.4, 1.34, 20, 8).scale(1, 1, 0.74).translate(0, 0.86, 0), 0.03, s0 + 1), paint);
  add(weathered(new THREE.SphereGeometry(0.36, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.0, 0.36, 0.74).translate(0, 1.52, 0), 0.02, s0 + 2), paint);
  add(new THREE.CylinderGeometry(0.19, 0.22, 0.16, 14).scale(1, 1, 0.9).translate(0, 1.62, 0.01), paint);
  // head: big, a little forward, a flattened face
  const hy = 1.88;
  add(weathered(new THREE.SphereGeometry(0.27, 22, 16).scale(0.95, 1.12, 0.9).translate(0, hy, 0.0), 0.015, s0 + 3), paint);
  add(weathered(new THREE.BoxGeometry(0.4, 0.36, 0.08, 4, 4, 1).translate(0, hy - 0.03, -0.2), 0.008, s0 + 4), paint);
  // the heavy brow ridge (an arch), the deep eye sockets, the almond eyes inside them
  add(pole(v3(-0.16, hy + 0.06, -0.225), v3(0, hy + 0.085, -0.25), 0.035, 0.038, 8), paint);
  add(pole(v3(0, hy + 0.085, -0.25), v3(0.16, hy + 0.06, -0.225), 0.038, 0.035, 8), paint);
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.05, 10, 8).scale(1.3, 0.75, 0.5).translate(sx * 0.085, hy + 0.02, -0.232), carve);
    add(new THREE.SphereGeometry(0.03, 10, 6).scale(1.5, 0.55, 0.5).translate(sx * 0.085, hy + 0.018, -0.245), paint);
    // the moustache: thick, drooping past the mouth, the ends curling out
    add(pole(v3(sx * 0.012, hy - 0.085, -0.268), v3(sx * 0.07, hy - 0.1, -0.258), 0.026, 0.024, 7), paint);
    add(pole(v3(sx * 0.07, hy - 0.1, -0.258), v3(sx * 0.115, hy - 0.16, -0.24), 0.024, 0.018, 7), paint);
    add(pole(v3(sx * 0.115, hy - 0.16, -0.24), v3(sx * 0.14, hy - 0.2, -0.225), 0.018, 0.01, 6), paint);
    add(new THREE.SphereGeometry(0.05, 8, 6).scale(0.45, 1.1, 0.8).translate(sx * 0.255, hy + 0.0, -0.02), paint);    // ears
  }
  // nose: a long wedge from the brow
  { const g = new THREE.CylinderGeometry(0.022, 0.05, 0.17, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9); add(g.translate(0, hy - 0.02, -0.255), paint); }
  add(new THREE.BoxGeometry(0.09, 0.014, 0.02).translate(0, hy - 0.13, -0.245), carve);                                         // mouth
  if (variant === 1) {
    add(weathered(new THREE.ConeGeometry(0.28, 0.32, 18, 2).scale(1, 1, 0.9).translate(0, hy + 0.36, 0.01), 0.012, s0 + 5), paint);
    add(new THREE.TorusGeometry(0.26, 0.028, 5, 20).rotateX(Math.PI / 2).scale(1, 1, 0.9).translate(0, hy + 0.2, 0), paint);
    add(new THREE.ConeGeometry(0.06, 0.14, 6).rotateX(Math.PI).translate(0, hy - 0.26, -0.2), paint);                           // short beard
  } else {
    add(new THREE.TorusGeometry(0.25, 0.026, 5, 20).rotateX(Math.PI / 2 - 0.15).scale(1, 1, 0.9).translate(0, hy + 0.14, 0.02), carve);  // headband
  }
  // right arm (+x) in relief: upper arm down the side, forearm across the chest, the hand holding the goblet
  add(new THREE.CapsuleGeometry(0.075, 0.34, 3, 10).scale(1, 1, 0.65).rotateZ(0.07).translate(0.33, 1.3, -0.12), paint);
  add(pole(v3(0.31, 1.1, -0.22), v3(0.05, 1.24, -0.29), 0.07, 0.06, 10), paint);
  add(new THREE.SphereGeometry(0.068, 10, 8).scale(1.05, 0.9, 0.75).translate(0.03, 1.25, -0.31), paint);
  add(new THREE.CylinderGeometry(0.075, 0.04, 0.14, 12).translate(-0.02, 1.36, -0.31), paint);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6).translate(-0.02, 1.27, -0.31), paint);
  add(new THREE.TorusGeometry(0.072, 0.012, 4, 12).rotateX(Math.PI / 2).translate(-0.02, 1.43, -0.31), carve);
  // left arm (−x): hand on the sabre hilt at the belt
  add(new THREE.CapsuleGeometry(0.075, 0.34, 3, 10).scale(1, 1, 0.65).rotateZ(-0.07).translate(-0.33, 1.3, -0.12), paint);
  add(pole(v3(-0.31, 1.1, -0.2), v3(-0.19, 0.95, -0.29), 0.066, 0.056, 10), paint);
  add(new THREE.SphereGeometry(0.064, 10, 8).scale(1, 0.9, 0.75).translate(-0.18, 0.93, -0.3), paint);
  // belt, pendants, the sabre
  add(new THREE.CylinderGeometry(0.385, 0.39, 0.08, 22).scale(1, 1, 0.76).translate(0, 0.86, 0), carve);
  for (const bx of [-0.22, -0.02, 0.18]) add(new THREE.BoxGeometry(0.05, 0.12, 0.025).translate(bx, 0.76, -0.29), paint);
  add(new THREE.BoxGeometry(0.06, 0.66, 0.03).rotateZ(-0.12).translate(-0.24, 0.5, -0.29), paint);
  add(new THREE.BoxGeometry(0.16, 0.035, 0.05).translate(-0.19, 0.86, -0.3), paint);
  const geo = kit.finish({ ao: { cell: 0.035, dist: 0.25, strength: 0.75 } });
  // a soft foot shade (the instances stand on grass)
  const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const k = 0.62 + 0.38 * Math.min(1, Math.max(0, pos.getY(i) / 0.5));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * (k * 0.9 + 0.1));
  }
  col.needsUpdate = true;
  return geo;
}

const worn = new WeakMap<Sky, Promise<{ geometry: THREE.BufferGeometry; material: THREE.Material }>>();
/** the generated balbal as the carved stele stands: turned to face −z, scaled to 2.15 m (one per sky) */
function generatedBalbal(sky: Sky): Promise<{ geometry: THREE.BufferGeometry; material: THREE.Material }> {
  let p = worn.get(sky);
  if (!p) {
    p = loadNalatiModel(sky, 'balbal', { rim: 0.35, bands: 0.8 }).then((model) => {
      const k = 2.15 / MODEL_SIZE.balbal[1];
      return { geometry: model.geometry.clone().rotateY(Math.PI).scale(k, k, k), material: model.material };
    });
    worn.set(sky, p);
    const cached = p; void cacheUntilDisposed(cached, () => { if (worn.get(sky) === cached) worn.delete(sky); });
  }
  return p;
}

/** the placed carved copies wear the generated model once it has loaded (same instances, slots and matrices) */
export function wearGenerated(meshes: readonly THREE.InstancedMesh[], sky: Sky): void {
  generatedBalbal(sky).then((g) => {
    for (const m of meshes) {
      if (m.count === 0) continue;
      m.geometry = g.geometry; m.material = g.material;
      m.computeBoundingSphere();
    }
    return g;
  }).catch((e: unknown) => { console.warn('[nalati] balbal model failed', e); });
}

export const balbal = defineModel<BalbalParams>({
  id: 'nalati-grasslands/balbal', name: 'Balbal', category: 'props', pipeline: ['trellis', 'code'],
  file: 'src/shards/nalati-grasslands/models/balbal.ts', surface: 'stone',
  defaults: { carved: null },
  variants: [
    { id: 'generated', label: 'TRELLIS.2', params: {} },
    { id: 'bare', label: 'Carved', params: { carved: 'bare' } },
    { id: 'capped', label: 'Carved · cap', params: { carved: 'capped' } },
  ],
  build: (ctx, p) => {
    if (p.carved !== null) return [{ geometry: balbalGeometry(p.carved === 'capped' ? 1 : 0), material: poiMaterial(ctx.sky), castShadow: true, receiveShadow: true }];
    // the specimen of what ships: the generated model, filled in when it lands
    const g = new THREE.Group();
    generatedBalbal(ctx.sky).then((m) => {
      const mesh = new THREE.Mesh(m.geometry, m.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: 'nalati-grasslands/balbal' } }));
      return m;
    }).catch((e: unknown) => { console.warn('[nalati] balbal model failed', e); });
    return g;
  },
});
