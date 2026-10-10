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
 * bear's plaque at −x, the boar's at +x (`gap` apart, centre to centre); y = 0 is the plaques' bottom points. No
 * colliders: they are ~6 cm deep on a wall.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { SlotGeometry } from '@wildshard/engine/models/slots';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';

import { TROPHY_DROP_GEOMETRY, TROPHY_PLAQUES_GEOMETRY, fixedGeometryReady, loadFixedGeometry } from '../boot/fixedGeometry';
import bakedSlots from '../data/trophySlots.json' with { type: 'json' };
import { TROPHY_LAYOUT } from '../data/trophyLayout';

export type TrophyId = 'bear' | 'boar';
export const TROPHIES: readonly TrophyId[] = ['bear', 'boar'];

/** the plaques' default spacing, centre to centre (m) */
export const PLAQUE_GAP = TROPHY_LAYOUT.gap;
/** where a trophy hangs on its plaque (the peg), from the plaque's bottom point */
const MOUNT_Y = TROPHY_LAYOUT.mountY;
/** panel front: board thickness plus panel offset */
const FRONT = TROPHY_LAYOUT.thickness + TROPHY_LAYOUT.panelOffset;

/** Shipped wall and loose-drop spacings use exact baked vertices. Other Explorer spacings translate each plaque's
 * own ranges together; the original has no AO and no collision or height law to recompute. */
function plaquesGeometry(gap: number): { slots: SlotGeometry; empty: Record<TrophyId, number>; full: Record<TrophyId, number> } {
  const geometry = (gap === 0 ? TROPHY_DROP_GEOMETRY : TROPHY_PLAQUES_GEOMETRY).copy();
  if (gap !== 0 && gap !== PLAQUE_GAP) {
    const position = geometry.getAttribute('position');
    for (const [i, id] of TROPHIES.entries()) {
      const shift = (gap - PLAQUE_GAP) * (id === 'bear' ? -0.5 : 0.5);
      for (const range of [bakedSlots.boards[i], bakedSlots.ranges[bakedSlots.empty[id]], bakedSlots.ranges[bakedSlots.full[id]]]) {
        if (range === undefined) throw new Error(`Missing trophy geometry range: ${id}`);
        for (let v = range.start; v < range.start + range.count; v++) position.setX(v, position.getX(v) + shift);
      }
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  return { slots: new SlotGeometry(geometry, bakedSlots.ranges), empty: bakedSlots.empty, full: bakedSlots.full };
}

/** the two plaques: one mesh; `setFilled(id, filled)` hangs a trophy or leaves its print */
export class TrophyPlaques extends THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  private readonly slots: SlotGeometry;
  private readonly empty: Record<TrophyId, number>;
  private readonly full: Record<TrophyId, number>;
  constructor(gap: number, material: THREE.Material, filled: Partial<Record<TrophyId, boolean>>) {
    const g = plaquesGeometry(gap);
    super(g.slots.geometry, material);
    this.slots = g.slots; this.empty = g.empty; this.full = g.full;
    this.name = 'trophy-plaques';
    this.castShadow = true;
    this.receiveShadow = true;
    for (const id of TROPHIES) this.setFilled(id, filled[id] ?? false);
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
    for (const t of TROPHIES) { this.slots.set(this.empty[t], false); this.slots.set(this.full[t], t === id); }
  }
}

export function buildTrophyPlaques(ctx: ModelContext, filled: Partial<Record<TrophyId, boolean>> = {}, gap: number = PLAQUE_GAP): TrophyPlaques {
  return new TrophyPlaques(gap, lowPolyMaterial(ctx.sky), filled);
}

/**
 * a loose trophy (the bear's claw, the boar's tusk) as the drop a kill leaves: the plaques' own claw / tusk alone, centred
 * on its origin (it hangs off the peg in the plaques' space), facing +z. One mesh, one draw, the island's material.
 */
export function buildTrophy(ctx: ModelContext, id: TrophyId): THREE.Group {
  const m = new TrophyPlaques(0, lowPolyMaterial(ctx.sky), {});
  m.trophyOnly(id);
  m.position.set(0, -(MOUNT_Y + (id === 'boar' ? 0.13 : 0.01)), -FRONT - 0.04);
  const g = new THREE.Group();
  g.name = `trophy-${id}`;
  g.add(m);
  return g;
}


export interface TrophyPlaquesParams {
  readonly bear: boolean;
  readonly boar: boolean;
  /** centre to centre, metres */
  readonly gap: number;
}

export const trophyPlaques = defineModel<TrophyPlaquesParams>({
  id: 'driftwood-isle/trophy-plaques', name: 'Trophy plaques', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trophyPlaques.ts', surface: 'wood',
  defaults: { bear: true, boar: true, gap: PLAQUE_GAP },
  variants: [
    { id: 'both', label: 'Both', params: {} },
    { id: 'empty', label: 'Empty', params: { bear: false, boar: false } },
    { id: 'bear', label: 'Bear', params: { boar: false } },
    { id: 'boar', label: 'Boar', params: { bear: false } },
  ],
  build: (ctx, p) => fixedGeometryReady() ? buildTrophyPlaques(ctx, { bear: p.bear, boar: p.boar }, p.gap) : loadingSpecimen('driftwood-isle/trophy-plaques', [p.gap + 0.34, 0.43, 0.16], async () => {
    await loadFixedGeometry();
    return buildTrophyPlaques(ctx, { bear: p.bear, boar: p.boar }, p.gap);
  }),
});
