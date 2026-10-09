/**
 * The sea glass wind chime (E314, project/archive/2026-09-30-driftwood-loot.md, Jake's pick board 3 C): a bleached driftwood bar hung
 * from a cord in the doorway of Wendell's hut, with three strands of sea glass under it that grow as you find pieces on
 * the beach — the centre strand fills first (1–5), then the left (6–10), then the right (11–15). The bottom piece of
 * each strand is a big one, so each milestone (5 / 10 / 15) ends on a piece you notice.
 *
 * One mesh, one draw on the island's shared low-poly material (flat-shaded vertex colour): every piece is in the
 * geometry and `setCount(n)` shows the first n (src/engine/models/slots.ts: an index rewrite, no allocation, one small upload
 * when the count changes). The strands sway in the island's one wind in the vertex shader (the kit's `sway`, wind.ts):
 * nothing runs per frame, and the shadow sways with them (swayDepthMaterial). Each strand has its own phase, so they
 * drift apart and back like a chime; a piece and its thread share their strand's weight at every height, so they never
 * part.
 *
 * Own space: the origin is the hook the cord hangs from, the chime below it (y < 0, ~0.95 m to the lowest piece),
 * x along the bar, the faces toward ±z. No colliders: it hangs over the doorway, out of the way.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { SlotGeometry, SlotRecorder } from '@wildshard/engine/models/slots';
import { log, rock, rope } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';

/** pieces the chime can hold (the beach's sea glass: DRIFTWOOD-LOOT) */
export const CHIME_PIECES = 15;
const PER_STRAND = 5;
/** the bar's underside, where the strands are tied */
const BAR_Y = -0.15;
/** the strands, in the order they fill: centre, left, right (x, first gap, gap between pieces) */
const STRANDS = [{ x: 0, gap: 0.14 }, { x: -0.21, gap: 0.122 }, { x: 0.21, gap: 0.126 }] as const;
/** how far down the strands sway fully (the wind's weight rises from 0 at the bar to SWAY_W here) */
const SWAY_BOTTOM = -0.95, SWAY_W = 0.45;

const C = {
  cord: '#b99d6c', wood: '#bcaa8f', woodB: '#a8967a', woodEnd: '#8f7d64',
};
/** each piece's colour, in the order they are found: mostly the common beach colours (aqua, seafoam, bottle green,
 *  frosted white), one cobalt and one amber; every strand ends on a big bright piece */
const GLASS = [
  '#62dccd', '#8ff0b8', '#d4f3ea', '#55c585', '#5fe6d8',   // centre
  '#8ff0b8', '#4c82e6', '#62dccd', '#d4f3ea', '#55c585',   // left
  '#62dccd', '#55c585', '#e8a24a', '#8ff0b8', '#9fe9f5',   // right
];

/** the chime: one mesh; `setCount(n)` shows the first n pieces */
export class SeaGlassChime extends THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  private readonly slots: SlotGeometry;
  private n = 0;
  constructor(slots: SlotGeometry, material: THREE.Material, count: number) {
    super(slots.geometry, material);
    this.slots = slots;
    this.name = 'sea-glass-chime';
    this.castShadow = true;
    this.receiveShadow = true;
    this.customDepthMaterial = swayDepthMaterial();
    this.setCount(count);
  }
  /** pieces shown (0 … 15) */
  get pieces(): number { return this.n; }
  /** show the first `n` pieces (clamped to 0 … 15) */
  setCount(n: number): void {
    this.n = Math.max(0, Math.min(CHIME_PIECES, Math.floor(n)));
    this.slots.setRun(1, 1 + CHIME_PIECES, this.n);
  }
}

/** the chime's geometry: slot 0 the cord and bar, slots 1 … 15 the pieces in the order they are found */
function chimeGeometry(): SlotGeometry {
  const kit = new LowPolyKit(0x5ea61a55);
  const rng = kit.rng;
  const rec = new SlotRecorder(kit);
  const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

  // ── slot 0: the hanging cord (a V from the hook to the bar's ends) and the driftwood bar ──
  kit.add(rope([v(0, 0, 0), v(-0.27, BAR_Y + 0.02, 0)], 0.005, 3), C.cord, { jitter: 0.03 });
  kit.add(rope([v(0, 0, 0), v(0.27, BAR_Y + 0.02, 0)], 0.005, 3), C.cord, { jitter: 0.03 });
  kit.add(log(v(-0.35, BAR_Y + 0.012, -0.004), v(0.02, BAR_Y - 0.004, 0.008), 0.03, 0.033, 6, 0.3), C.wood, { wobble: 0.004 });
  kit.add(log(v(0, BAR_Y - 0.004, 0.008), v(0.34, BAR_Y + 0.008, -0.006), 0.033, 0.024, 6, 0.9), C.woodB, { wobble: 0.004 });
  kit.add(log(v(-0.12, BAR_Y + 0.01, 0.004), v(-0.165, BAR_Y + 0.07, 0.022), 0.012, 0.005, 5), C.woodEnd); // a snapped twig
  for (const s of STRANDS) kit.add(new THREE.TorusGeometry(0.02, 0.005, 3, 6).translate(s.x, BAR_Y - 0.004, 0), C.cord, { jitter: 0.03 }); // the tie
  rec.mark();

  // ── slots 1 … 15: each piece with the thread down to it from the one above ──
  for (const [si, s] of STRANDS.entries()) {
    const sway = { w: SWAY_W, phase: si * 2.1 + 0.4, span: [BAR_Y - 0.01, SWAY_BOTTOM] as [number, number] };
    let top = v(s.x, BAR_Y - 0.02, 0);
    let y = BAR_Y - s.gap * 0.72;
    for (let k = 0; k < PER_STRAND; k++) {
      const last = k === PER_STRAND - 1;
      const r = last ? 0.066 : rng.range(0.04, 0.052);
      const hx = s.x + rng.range(-0.006, 0.006);
      const cy = y - r;
      // the glass: a flat, frosted, rounded-off chip (a squashed faceted pebble turned to face ±z), a little taller than wide
      const chip = rock(r, 0, rng, 0.42, 0.26);
      chip.rotateX(Math.PI / 2).rotateZ(rng.range(-0.5, 0.5)).scale(0.9, last ? 1.35 : 1.18, 1).translate(hx, cy, rng.range(-0.004, 0.004));
      kit.add(rope([top, v(hx, cy, 0)], 0.0035, 3), C.cord, { jitter: 0.02, sway });
      kit.add(chip, GLASS[si * PER_STRAND + k] ?? '#62dccd', { jitter: 0.08, sway });
      rec.mark();
      top = v(hx, cy - r * 0.9, 0);
      y = cy - r - s.gap * 0.5;
    }
  }
  return new SlotGeometry(kit.finish({ ao: false }), rec.ranges);
}

/** a chime showing `count` pieces */
export function buildSeaGlassChime(ctx: ModelContext, count = 0): SeaGlassChime {
  return new SeaGlassChime(chimeGeometry(), lowPolyMaterial(ctx.sky), count);
}

export interface SeaGlassChimeParams {
  /** pieces shown, 0 … 15 */
  readonly count: number;
}

export const seaGlassChime = defineModel<SeaGlassChimeParams>({
  id: 'driftwood-isle/sea-glass-chime', name: 'Sea glass wind chime', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/seaGlassChime.ts', surface: 'wood',
  defaults: { count: CHIME_PIECES },
  variants: [0, 5, 10, 15].map((n) => ({ id: `${n}`, label: `${n} / 15`, params: { count: n } })),
  build: (ctx, p) => buildSeaGlassChime(ctx, p.count),
});
