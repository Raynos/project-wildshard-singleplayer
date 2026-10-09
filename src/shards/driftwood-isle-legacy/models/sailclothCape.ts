/**
 * The sailcloth cape (E314, project/archive/2026-09-30-driftwood-loot.md: a shop good, look only, and a GEAR cosmetic): a short cape cut
 * from an old sail — weathered canvas panels with a darker seam between them, a stitched-on patch, a faded red stripe
 * above a ragged hem — tied at the throat with a length of rope. It wraps round the shoulders and falls open and
 * flatter to the knees, with soft pleats that deepen toward the hem.
 *
 * One mesh, one draw on the island's shared low-poly material, ~130 triangles. The cloth sways in the island's one wind in
 * the vertex shader (the kit's `sway`: still at the shoulders, most at the hem; nothing runs per frame) and its shadow
 * sways with it (swayDepthMaterial). src/engine/player/Cosmetics.ts hangs it on the player's shoulder socket.
 *
 * Own space: the wearer's axis is x = 0, z = 0, the wearer faces +Z (the cape hangs behind, at −z); y = 0 is the hem's
 * lowest line and the neck is at CAPE_H. No colliders.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { rock, rope, tris } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';

/** the neck's height over the hem (m) */
export const CAPE_H = 1.0;
const COLS = 8, ROWS = 7;

const C = {
  canvas: '#e0d3b3', canvasB: '#d2c3a1', seam: '#b9a47e', patch: '#b39a70', stripe: '#a95a4a', hem: '#c6b58f', rope: '#b99d6c', knot: '#a4885a',
};

/** the cloth at (u across −1…1, v down 0…1): its position in own space */
function clothPoint(u: number, v: number, rag: number): THREE.Vector3 {
  const half = 0.15 + 0.2 * v;                 // half the width along the cloth: 0.15 at the neck, 0.35 at the hem
  const wrap = 1.25 - 0.62 * v;                // how far round the body it reaches (rad either side)
  const r = half / wrap;
  const zc = -0.12 - 0.07 * v;                 // the middle of the back, falling away from the body toward the hem
  const a = u * wrap;
  const pleat = 0.022 * v * Math.sin(u * Math.PI * 2.5 + 0.6);
  const y = CAPE_H * (1 - v) - 0.045 * u * u * (1 - v) + rag;
  return new THREE.Vector3(Math.sin(a) * (r + pleat), y, zc + r * (1 - Math.cos(a)) - pleat * Math.cos(a));
}

/** the cape's geometry in own space (one draw; every cloth vertex carries its sway weight) */
export function sailclothCapeGeometry(): THREE.BufferGeometry {
  const kit = new LowPolyKit(0x5a11c1);
  const rng = kit.rng;
  const rag = Array.from({ length: COLS + 1 }, () => rng.range(-0.035, 0.035));
  const grid: THREE.Vector3[][] = [];
  for (let j = 0; j <= ROWS; j++) {
    const row: THREE.Vector3[] = [];
    for (let i = 0; i <= COLS; i++) row.push(clothPoint((i / COLS) * 2 - 1, j / ROWS, j === ROWS ? (rag[i] ?? 0) : 0));
    grid.push(row);
  }
  const sway = { w: 0.55, phase: 0.8, span: [CAPE_H, 0] as [number, number] };
  // one colour per quad: canvas panels (two tones, a darker seam column between them), a patch, a stripe row, the hem row
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = grid[j]?.[i], b = grid[j]?.[i + 1], c = grid[j + 1]?.[i + 1], d = grid[j + 1]?.[i];
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
      const colour = j === ROWS - 1 ? C.hem : j === ROWS - 2 ? C.stripe : i === 5 && j === 3 ? C.patch : i === 3 || i === 4 ? (i === 3 ? C.seam : C.canvasB) : i < 3 ? C.canvas : C.canvasB;
      kit.add(tris([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z]), colour, { jitter: 0.05, sway });
    }
  }
  // the rope tie across the throat, from shoulder to shoulder, knotted in front
  const l = grid[0]?.[0], r = grid[0]?.[COLS];
  if (l !== undefined && r !== undefined) {
    const knot = new THREE.Vector3(0, CAPE_H - 0.07, 0.085);
    kit.add(rope([l, new THREE.Vector3(l.x * 0.55, CAPE_H - 0.05, 0.06), knot, new THREE.Vector3(r.x * 0.55, CAPE_H - 0.05, 0.06), r], 0.009, 4), C.rope, { jitter: 0.04 });
    kit.add(rock(0.018, 0, rng, 0.8, 0.25).translate(knot.x, knot.y, knot.z), C.knot);
    kit.add(rope([knot, knot.clone().add(new THREE.Vector3(-0.012, -0.07, 0.008))], 0.006, 3), C.rope, { sway: { w: 0.2, hang: true } });
    kit.add(rope([knot, knot.clone().add(new THREE.Vector3(0.014, -0.06, 0.01))], 0.006, 3), C.rope, { sway: { w: 0.2, hang: true } });
  }
  return kit.finish({ ao: false });
}

/** the cape as one mesh (a specimen, the worn cape) */
export function buildSailclothCape(ctx: ModelContext): THREE.Mesh {
  const m = new THREE.Mesh(sailclothCapeGeometry(), lowPolyMaterial(ctx.sky));
  m.name = 'sailcloth-cape';
  m.castShadow = true;
  m.receiveShadow = true;
  m.customDepthMaterial = swayDepthMaterial();
  return m;
}

export interface SailclothCapeParams {
  /** uniform size (1 = the player's) */
  readonly size: number;
}

export const sailclothCape = defineModel<SailclothCapeParams>({
  id: 'driftwood-isle/sailcloth-cape', name: 'Sailcloth cape', category: 'gear', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/sailclothCape.ts', surface: 'felt',
  defaults: { size: 1 },
  specimenYaw: Math.PI, // the Explorer opens on its outside (the back)
  build: (ctx, p): readonly ModelPart[] => [{
    geometry: ctx.once(`sailcloth-cape:${p.size}`, () => (p.size === 1 ? sailclothCapeGeometry() : sailclothCapeGeometry().scale(p.size, p.size, p.size))),
    material: lowPolyMaterial(ctx.sky), castShadow: true, receiveShadow: true, customDepthMaterial: swayDepthMaterial(),
  }],
});
