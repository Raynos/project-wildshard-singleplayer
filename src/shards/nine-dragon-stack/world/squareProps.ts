// The square's props placed (dome B, E169; E306 / E315 M4): the guardian lions and the procedural sets the square's
// builders queued (props3d.ts: the balustrade's carved panels, the market's booths and parasol tables, the dining
// pavilions), each its model (../models/) drawn as one InstancedMesh and handed to the fragment's culler. The lion's cast
// is loaded first (`place` builds from what is loaded); a set's geometry is the one its builder made at the first copy.
// Each is placed in slices (`placeSliced` on the build's `due`, op-hitch29): the lion's LODs were one ~0.1 s task.
import { Matrix4, type BufferGeometry, type Group } from 'three';
import type { WorldRows } from '../runtime/productSections.generated';
import { ModelPlacementBatch } from '@wildshard/engine/models/placementBatch';
import type { ModelContext, ModelDef, Placement } from '@wildshard/engine/models/model';
import { type Placed, copiesAt, placeSliced } from '@wildshard/engine/models/place';
import { placeSet } from '@wildshard/engine/models/sets';
import { guardianLion, loadLion } from '../models/lion';
import { diningPavilion, marketBooth, parasolTable } from '../models/market';
import { balustradePanel } from '../models/catalogue';
import { namePlacedDraws as nameDraws } from '../runtime/cull/placedDraws';
import type { NdLook } from './modelLook';


/** the model each queued set is (and the pavilion: diningPavilion, its copies carrying their turn) */
const SETS: Readonly<Record<string, ModelDef<Record<string, unknown>>>> = { booth: marketBooth, parasol: parasolTable, 'balustrade-panel': balustradePanel };

const at = (m: Matrix4): Placement<Record<string, unknown>> => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m });

/** what the named places' Sets take from the square's props (world/sets.ts): Lantern Square's balustrade panels and its
 *  lions, the stair-street's lions (the street's balustrade), the Well rim's */
export interface SquareShares { readonly square: Placed[]; readonly stair: Placed[]; readonly rim: Placed[] }

/** place the lions and the queued sets under `root` (their draws named `glb:lion`, `set:<name>` as before), pausing on
 *  `due` (the build's slicer, `placeSliced`); the night market is its named place's Set; returns what the other places'
 *  Sets take (world/sets.ts) */
export async function placeSquareProps(p: { ctx: ModelContext; look: NdLook; root: Group; rows: WorldRows; records: Float64Array; sets: ReadonlyMap<string, BufferGeometry>; due: () => Promise<void> | null }): Promise<SquareShares> {
  const { lions: lionFrames, shares: share, sets } = p.rows;
  const lions = lionFrames.map(frame => new Matrix4().fromArray(p.records, frame));
  const batch = new ModelPlacementBatch({ ctx: p.ctx,  parent: p.root, due: p.due });
  const out = { square: [] as Placed[], stair: [] as Placed[], rim: [] as Placed[] };
  if (lions.length > 0) {
    try {
      await loadLion(p.look);
      const placed = await batch.frames(guardianLion, lions, undefined, { draw: 'instanced', cull: { bounds: 'sphere' }, piece: { id: 'nds-lions' } });
      nameDraws(placed, 'glb:lion');
      for (const [k, idx] of [['square', share.plaza], ['stair', share.street], ['rim', share.rim]] as const) { const s = copiesAt(placed, idx); if (s !== null) out[k].push(s); }
    } catch (e: unknown) { console.warn('nine-dragon: prop lion failed to load', e); }
  }
  const market: Placed[] = [];
  for (const { name, frames } of sets) {
    const geo = p.sets.get(name); if (geo === undefined) throw new Error(`Missing set geometry ${name}`);
    const s = { geo, at: frames.map(frame => new Matrix4().fromArray(p.records, frame)) };
    const opts = { ctx: p.ctx, draw: 'instanced', cull: { bounds: 'sphere' },  parent: p.root, piece: { id: `nds-set-${name}` } } as const;
    let placed: Placed;
    if (name === 'pavilion') {
      // (a pavilion's colliders stay square to the world at its turn: its copies carry the turn, models/market.ts)
      p.look.geo.set(`set:${name}`, s.geo);
      placed = await placeSliced(diningPavilion, s.at.map((m) => ({ ...at(m), params: { turn: Math.atan2(m.elements[8], m.elements[0]) } })), opts, p.due);
    } else {
      const model = SETS[name];
      if (model === undefined) throw new Error(`nine-dragon: the set '${name}' is no model (world/squareProps.ts SETS)`);
      p.look.geo.set(`set:${name}`, s.geo);
      placed = await placeSliced(model, s.at.map(at), opts, p.due);
    }
    nameDraws(placed, `set:${name}`);
    if (name === 'balustrade-panel') out.square.push(placed); else market.push(placed);
  }
  // the square's night market, one place: its booths, parasol tables and dining pavilions (E306 M7's sets explorer)
  if (market.length > 0) placeSet({ id: 'nine-dragon-stack/night-market', name: 'Lantern Square night market', file: 'src/shards/nine-dragon-stack/generators/stalls.ts', place: 'nine-dragon-stack/night-market', members: market });
  return out;
}
