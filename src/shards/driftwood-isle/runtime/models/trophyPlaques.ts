/**
 * The trophy plaques (E314, project/archive/2026-09-30-driftwood-loot.md, Jake's pick board 4 A): two shield-shaped wooden plaques for
 * the back wall of Wendell's hut — the bear's plaque holds a hooked bear claw, the boar's a curved ivory tusk. An empty
 * plaque reads as "a fight is still out there": a bare mounting peg and the beast's print burnt into the wood (a bear's
 * paw, a boar's cloven hoof) where its trophy will hang. The Drowned Captain's hat is worn, not hung (board 4 C).
 *
 * One mesh, one draw on the island's shared low-poly material: both plaques, both prints and both trophies are in the
 * geometry and `setFilled(id, filled)` swaps a print for its trophy (src/engine/models/slots.ts: an index rewrite, no allocation,
 * only when a trophy is won). The claw and the tusk are swept along parallel-transport frames with a tapering round
 * section, darker at the root and pale at the tip.
 *
 * Own space: the wall is the plane z = 0 and the plaques stand out of it toward +z (their front); x along the wall, the
 * bear's plaque at −x, the boar's at +x (the authored spacing apart, centre to centre); y = 0 is the plaques' bottom
 * points. No colliders: they are ~6 cm deep on a wall. Both bakes are exact: the wall's, and the loose drop's (gap 0).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { SlotGeometry } from '../models/slots';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';

import { loadFixedGeometry, fixedDraw } from '../boot/modelGeometry';
import { driftwoodRows } from '../boot/rows';

export type TrophyId = 'bear' | 'boar';
const trophies = () => driftwoodRows('custom/fixedLayouts').nativeView.TROPHY_LAYOUT.ids;

/** the most trophies the wall carries (today two: the bear's and the boar's) */
const MAX_TROPHIES = 8;
/** where a trophy hangs on its plaque (the peg), from the plaque's bottom point */
/** panel front: board thickness plus panel offset */

/** the two plaques: one mesh; `setFilled(id, filled)` hangs a trophy or leaves its print */
export class TrophyPlaques extends THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  private readonly slots: SlotGeometry;
  private readonly empty: Record<TrophyId, number>;
  private readonly full: Record<TrophyId, number>;
  /** `drop`: the loose-drop bake (the trophies at gap 0), else the wall's */
  constructor(drop: boolean, material: THREE.Material, filled: Partial<Record<TrophyId, boolean>>) {
    const baked = driftwoodRows('custom/fixedLayouts').trophySlots; // the product's baked ranges (data/trophySlots.json)
    const slots = new SlotGeometry((drop ? fixedDraw('trophyDrop') : fixedDraw('trophyPlaques')).copy(), baked.ranges);
    super(slots.geometry, material);
    this.slots = slots; this.empty = baked.empty; this.full = baked.full;
    this.name = 'trophy-plaques';
    this.castShadow = true;
    this.receiveShadow = true;
    for (let i = 0; i < Math.min(trophies().length, MAX_TROPHIES); i++) { const id = trophies()[i]; if (id !== undefined) this.setFilled(id, filled[id] ?? false); }
  }
  /** is this trophy hung */
  filled(id: TrophyId): boolean { return this.slots.shown(this.full[id]); }
  /** hang the trophy (true) or leave the plaque empty with the beast's print (false) */
  setFilled(id: TrophyId, filled: boolean): void {
    this.slots.set(this.full[id], filled);
    this.slots.set(this.empty[id], !filled);
  }
  /** the trophy alone, no plaques or prints (the loose drop a kill leaves, src/shards/driftwood-isle/loot/keepsakes.ts) */
  trophyOnly(id: TrophyId): void {
    this.slots.set(0, false);
    for (let i = 0; i < Math.min(trophies().length, MAX_TROPHIES); i++) { const t = trophies()[i]; if (t !== undefined) { this.slots.set(this.empty[t], false); this.slots.set(this.full[t], t === id); } }
  }
}

/**
 * a loose trophy (the bear's claw, the boar's tusk) as the drop a kill leaves: the plaques' own claw / tusk alone, centred
 * on its origin (it hangs off the peg in the plaques' space), facing +z. One mesh, one draw, the island's material.
 */
export function buildTrophy(ctx: ModelContext, id: TrophyId): THREE.Group {
  const m = new TrophyPlaques(true, lowPolyLookMaterial(ctx.sky, 'still'), {});
  m.trophyOnly(id);
  const layout = driftwoodRows('custom/fixedLayouts').nativeView.TROPHY_LAYOUT;
  m.position.set(0, -(layout.mountY + (id === 'boar' ? 0.13 : 0.01)), -layout.thickness - layout.panelOffset - 0.04);
  const g = new THREE.Group();
  g.name = `trophy-${id}`;
  g.add(m);
  return g;
}

export interface TrophyPlaquesParams {
  readonly bear: boolean;
  readonly boar: boolean;
}

export const trophyPlaques = defineModel<TrophyPlaquesParams>({
  id: 'driftwood-isle/trophy-plaques', name: 'Trophy plaques', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/trophyPlaques.ts', surface: 'wood',
  prepare: loadFixedGeometry,
  defaults: { bear: true, boar: true },
  variants: [
    { id: 'both', label: 'Both', params: {} },
    { id: 'empty', label: 'Empty', params: { bear: false, boar: false } },
    { id: 'bear', label: 'Bear', params: { boar: false } },
    { id: 'boar', label: 'Boar', params: { bear: false } },
  ],
  build: (ctx, p) => new TrophyPlaques(false, lowPolyLookMaterial(ctx.sky, 'still'), { bear: p.bear, boar: p.boar }),
});
