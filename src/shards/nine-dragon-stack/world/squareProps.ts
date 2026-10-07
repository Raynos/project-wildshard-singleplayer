// The square's props placed (dome B, E169; E306 / E315 M4): the guardian lions and the procedural sets the square's
// builders queued (props3d.ts: the balustrade's carved panels, the market's booths and parasol tables, the dining
// pavilions), each its model (../models/) drawn as one InstancedMesh and handed to the fragment's culler. The lion's cast
// is loaded first (`place` is synchronous); a set's geometry is the one its builder made at the first copy.
import type { Group, Matrix4 } from 'three';
import type { ModelContext, ModelDef, Placement } from '@wildshard/engine/models/model';
import { type InstancedCuller, type Placed, copiesAt, place } from '@wildshard/engine/models/place';
import { placeSet } from '@wildshard/engine/models/sets';
import { guardianLion, loadLion } from '../models/lion';
import { diningPavilion, marketBooth, parasolTable } from '../models/market';
import { balustradePanel } from '../models/balustradePanel';
import { liftChain, liftFrame } from '../models/lift';
import { nameDraws } from './facade/batch';
import type { NdLook } from './modelLook';
import { lionShares, takeLions, takeSets } from './props3d';

/** the model each queued set is (and the pavilion: diningPavilion, its copies carrying their turn) */
const SETS: Readonly<Record<string, ModelDef<object>>> = { booth: marketBooth, parasol: parasolTable, 'balustrade-panel': balustradePanel, 'lift-frame': liftFrame, 'lift-chain': liftChain };

const at = (m: Matrix4): Placement<object> => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m });

/** what the named places' Sets take from the square's props (world/sets.ts): Lantern Square's balustrade panels and its
 *  lions, the stair-street's lions (the street's balustrade), the Well rim's */
export interface SquareShares { readonly square: Placed[]; readonly stair: Placed[]; readonly rim: Placed[] }

/** place the lions and the queued sets under `root` (their draws named `glb:lion`, `set:<name>` as before); the night
 *  market is its named place's Set; returns what the other places' Sets take (world/sets.ts) */
export async function placeSquareProps(p: { ctx: ModelContext; look: NdLook; culler: InstancedCuller; root: Group }): Promise<SquareShares> {
  const lions = takeLions(), share = lionShares();
  const out = { square: [] as Placed[], stair: [] as Placed[], rim: [] as Placed[] };
  if (lions.length > 0) {
    try {
      await loadLion(p.look);
      const placed = place(guardianLion, lions.map(at), { ctx: p.ctx, draw: 'instanced', culler: p.culler, parent: p.root, piece: { id: 'nds-lions' } });
      nameDraws(placed, 'glb:lion');
      for (const [k, idx] of [['square', share.plaza], ['stair', share.street], ['rim', share.rim]] as const) { const s = copiesAt(placed, idx); if (s !== null) out[k].push(s); }
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
    // (SF51-p: the lantern lifts' frames and chain links, world/lifts.ts, belong to no named place yet)
    if (name === 'balustrade-panel') out.square.push(placed); else if (!name.startsWith('lift-')) market.push(placed);
  }
  // the square's night market, one place: its booths, parasol tables and dining pavilions (E306 M7's sets explorer)
  if (market.length > 0) placeSet({ id: 'nine-dragon-stack/night-market', name: 'Lantern Square night market', file: 'src/shards/nine-dragon-stack/world/stalls.ts', place: 'nine-dragon-stack/night-market', members: market });
  return out;
}
