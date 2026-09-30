// The square's props placed (dome B, E169; E306 / E315 M4): the guardian lions and the procedural sets the square's
// builders queued (props3d.ts: the balustrade's carved panels, the market's booths and parasol tables, the dining
// pavilions), each its model (../models/) drawn as one InstancedMesh and handed to the fragment's culler. The lion's cast
// is loaded first (`place` is synchronous); a set's geometry is the one its builder made at the first copy.
import type { Group, Matrix4 } from 'three';
import type { ModelContext, ModelDef, Placement } from '../../../models/model';
import { type InstancedCuller, type Placed, place } from '../../../models/place';
import { placeSet } from '../../../models/sets';
import { guardianLion, loadLion } from '../models/lion';
import { diningPavilion, marketBooth, parasolTable } from '../models/market';
import { balustradePanel } from '../models/balustradePanel';
import { nameDraws } from './facade/batch';
import type { NdLook } from './modelLook';
import { takeLions, takeSets } from './props3d';

/** the model each queued set is (and the pavilion: diningPavilion, its copies carrying their turn) */
const SETS: Readonly<Record<string, ModelDef<object>>> = { booth: marketBooth, parasol: parasolTable, 'balustrade-panel': balustradePanel };

const at = (m: Matrix4): Placement<object> => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m });

/** place the lions and the queued sets under `root` (their draws named `glb:lion`, `set:<name>` as before) */
export async function placeSquareProps(p: { ctx: ModelContext; look: NdLook; culler: InstancedCuller; root: Group }): Promise<void> {
  const lions = takeLions();
  if (lions.length > 0) {
    try {
      await loadLion(p.look);
      const placed = place(guardianLion, lions.map(at), { ctx: p.ctx, draw: 'instanced', culler: p.culler, parent: p.root, piece: { id: 'nds-lions' } });
      nameDraws(placed, 'glb:lion');
    } catch (e: unknown) { console.warn('nine-dragon: prop lion failed to load', e); }
  }
  const market: Placed[] = [];
  for (const [name, s] of takeSets()) {
    const opts = { ctx: p.ctx, draw: 'instanced', culler: p.culler, parent: p.root, piece: { id: `nds-set-${name}` } } as const;
    let placed: Placed;
    if (name === 'pavilion') {
      // (a pavilion's colliders stay square to the world at its turn: its copies carry the turn, models/market.ts)
      p.look.geo.set(`set:${name}`, s.geo);
      placed = place(diningPavilion, s.at.map((m) => ({ ...at(m), params: { turn: Math.atan2(m.elements[8], m.elements[0]) } })), opts);
    } else {
      const model = SETS[name];
      if (model === undefined) throw new Error(`nine-dragon: the set '${name}' is no model (world/squareProps.ts SETS)`);
      p.look.geo.set(`set:${name}`, s.geo);
      placed = place(model, s.at.map(at), opts);
    }
    nameDraws(placed, `set:${name}`);
    if (name !== 'balustrade-panel') market.push(placed);
  }
  // the square's night market, one place: its booths, parasol tables and dining pavilions (E306 M7's sets explorer)
  if (market.length > 0) placeSet({ id: 'nine-dragon-stack/night-market', name: 'Lantern Square night market', file: 'src/chunks/nine-dragon-stack/world/stalls.ts', members: market });
}
