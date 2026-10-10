/**
 * The yurt (E306 / E315 second pass): a Kazakh felt yurt (kiiz üi), painted (B5, look pass N7; was
 * src/world/nalati/Yurt.ts). Built to the mockups (style-B master frame, taming-3, concept-1):
 *   - the BASE: the felt skirt rolled up for summer so the wooden lattice (kerege) shows — diagonal slats on the dark
 *     interior — or, on some yurts, a woven reed screen (shi) with its red diamond pattern;
 *   - the WALL: white felt draped over the lattice heads (soft vertical folds, a belly, a panel overlap half way up,
 *     grubbier toward the ground), a wide red-orange ornament band (a stepped ram's-horn repeat) under the eave, two
 *     rope bands, and woven tassel ropes hanging down the wall;
 *   - the ROOF: felt over the roof poles (uyk) — it sags between them, so every rib reads — with a narrower band low
 *     on the dome, rope straps down the ribs and three guy ropes pegged to the ground;
 *   - the CROWN: the shangyrak ring with its crossed arches, the square smoke flap (tündik) pulled half back, its ropes;
 *   - the DOOR: a carved, painted double door in a frame with a scrolled pediment, iron ring pulls, the felt door
 *     curtain rolled up above it; optionally a stove flue out of the crown (its smoke is the shard's), and a pennant on
 *     a short pole at the crown (the pennant's cloth is the shard's).
 *
 * SHARD-PLATFORM M3 (the places bake): the painter runs offline only (../generators/yurt.ts, painted into each camp's mesh
 * by ../generators/places.ts); the page draws the bake (../world/placeBake.ts). Here is the model's def.
 *
 * Placed at the lowest ground under its footprint (`at.y`), `at.yaw` the way its door faces (0 = −z / south). Painted
 * into its camp's one mesh, the wall's felt tile on the camp's 'felt' layer (src/shards/nalati-grasslands/world/painted.ts): the spring
 * camp stands six, the summer camp three (src/shards/nalati-grasslands/world/NomadCamp.ts, SummerCamp.ts). ~9 k triangles for r = 3.
 * Collides: the felt wall as a 16-sided prism, the roof as a frustum (`yurtSolid`); its two crossed squares are data
 * only (the weather's yurts).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { bakedPainted } from '../world/placeBake';

export interface YurtParams {
  /** wall radius (m), 2.4–3.6 */
  readonly r: number;
  /** a stove pipe out of the crown, smoking */
  readonly flue: boolean;
  /** 0..2 — band colourway */
  readonly palette: number;
  /** an older, greyer felt */
  readonly old: boolean;
  readonly base: 'lattice' | 'reed' | 'felt';
  /** a red (palette 0) or orange pennant on a short pole at the crown */
  readonly pennant: boolean;
}

export const yurt = defineModel<YurtParams>(bakedPainted<YurtParams>({
  id: 'nalati-grasslands/yurt', name: 'Yurt', category: 'buildings', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/generators/yurt.ts', surface: 'felt',
  defaults: { r: 3, flue: true, palette: 0, old: false, base: 'lattice', pennant: true },
  variants: [
    { id: 'lattice', label: 'Lattice', params: {} },
    { id: 'reed', label: 'Reed screen', params: { base: 'reed', palette: 1, r: 3.5 } },
    { id: 'felt', label: 'Felt, old', params: { base: 'felt', palette: 2, old: true, flue: false, pennant: false, r: 2.8 } },
  ],
}));
