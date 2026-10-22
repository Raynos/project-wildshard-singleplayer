import type { WorldUpdatesRows } from '@wildshard/format/worldUpdates';
import { REEF_LOOK } from './reefLook';
import cove from '../data/coveComposition.json' with { type: 'json' };

/** The original entered native update order; construction remains resident. */
export function driftwoodWorldUpdates(): WorldUpdatesRows {
  return [
    { kind: 'wind', system: 'shard.driftwood.palms', before: ['main.world'] },
    { kind: 'rope-deck', system: 'shard.driftwood.bridge.pose', before: ['main.world'], deck: 'bridge', chain: 'bridge.deck' },
    { kind: 'toon-look', system: 'shard.driftwood.seabed', before: ['main.world'], look: REEF_LOOK },
    { kind: 'toon-look', system: 'shard.driftwood.cove', before: ['main.world'], look: cove.look },
    { kind: 'buildings', system: 'shard.driftwood.shrine', before: ['main.world'], owner: 'shrine' },
  ];
}
