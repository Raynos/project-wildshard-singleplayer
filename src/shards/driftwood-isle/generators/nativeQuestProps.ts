import * as v from 'valibot';
import { NativeQuestPropsSchema } from '@wildshard/format/questInteractions';
import { autoFlag } from '@wildshard/engine/world/interact/types';
import { DRIFTWOOD_INTERACT } from './interactables';
import { DECLARED_SEA } from './sea';
import spots from '../data/spots.generated.json' with { type: 'json' };
import physics from '../data/physics.generated.json' with { type: 'json' };
import policy from '../data/nativeQuest.json' with { type: 'json' };

const at = (id: string) => {
  const found = spots.rows.find(row => row.id === id); if (found === undefined) throw new Error(`Missing prop placement: ${id}`); return found;
};
const point = (id: string) => { const { x, y, z } = at(id); return { x, y, z }; };
const hold = physics.habitat.hold, side = Math.round(2 * hold.guardR / hold.step) + 1;
/** The cave's captured floor samples (the drops' floor and, G566, the barrel watch's declared floor). */
export const NATIVE_FLOORS = [{ x: hold.x - hold.guardR, z: hold.z - hold.guardR, step: hold.step, width: side, height: side, values: hold.floor }];
/** G566: the tide barrel and plates, read by the barrel watch script (generators/barrelDecision.ts). */
export const NATIVE_BARRELS = DRIFTWOOD_INTERACT.rows.flatMap(row => row.kind === 'barrel' ? [{ id: row.id, home: point(row.id), yaw: at(row.id).yaw,
  leash: row.leash, owner: policy.barrelOwner }] : []);
export const NATIVE_PLATES = DRIFTWOOD_INTERACT.rows.flatMap(row => row.kind === 'plate' ? [{ at: point(row.id), size: row.size, when: row.showWhen }] : []);
export const NATIVE_WATER = DECLARED_SEA.level;
/** Physical prop and platform samples; the barrel's watch is the shard's decision script (G566), its save key the declared body. */
export const NATIVE_QUEST_PROPS = v.parse(NativeQuestPropsSchema, {
  drops: [policy.keyDrop],
  floors: NATIVE_FLOORS,
  bodies: NATIVE_BARRELS.map(row => ({ owner: row.owner.id, body: 'barrel' })),
  gates: DRIFTWOOD_INTERACT.rows.flatMap(row => {
    if (row.kind !== 'door' || row.latch !== true || row.opensWhen === undefined) return [];
    const spot = at(row.id), flag = autoFlag(row);
    if (!('collider' in spot) || flag === null) throw new Error('Native gate needs its captured collider and flag');
    const { x, z, hw, hd, yTop, yBottom } = spot.collider;
    return [{ flag, box: { x, z, hw, hd, yTop, yBottom } }];
  }),
});
