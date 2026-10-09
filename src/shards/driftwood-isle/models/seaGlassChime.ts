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
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { SlotGeometry } from '@wildshard/engine/models/slots';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { swayDepthMaterial } from '@wildshard/engine/world/wind';

import { CHIME_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';
import bakedSlots from '../data/chimeSlots.json' with { type: 'json' };

/** Maximum collectible pieces; slot 0 is always the cord and bar. */
export const CHIME_PIECES = 15;

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

/** a chime showing `count` pieces */
export function buildSeaGlassChime(ctx: ModelContext, count = 0): SeaGlassChime {
  return new SeaGlassChime(new SlotGeometry(CHIME_GEOMETRY.copy(), bakedSlots), lowPolyMaterial(ctx.sky), count);
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
  build: (ctx, p) => fixedGeometryReady() ? buildSeaGlassChime(ctx, p.count) : loadingSpecimen('driftwood-isle/sea-glass-chime', [0.7, 0.95, 0.1], async () => {
    await loadFixedGeometry();
    return buildSeaGlassChime(ctx, p.count);
  }),
});
