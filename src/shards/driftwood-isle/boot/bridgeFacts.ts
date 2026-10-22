import bake from '../data/bridgeBake.json' with { type: 'json' };
import { RopeDeckSite } from '@wildshard/game/models/ropeDeckSite';
import { ISLAND } from '../runtime/boot/blobAssets';

/** The rope bridge over the gully on the headland climb (E306 / E315 M1; PHYSICS.md, the rope bridge): a rope deck site
 *  on its baked rest facts (generators/driftwoodBridge.mjs: the island span, then the Explorer specimen's), its skinned decks drawn from the island library. */
export const ROPE_BRIDGE = new RopeDeckSite({
  model: { id: 'driftwood-isle/rope-bridge', name: 'Rope bridge', category: 'buildings', pipeline: 'code', file: 'src/shards/driftwood-isle/boot/bridgeFacts.ts', surface: 'planks' },
  specimen: 1, loading: [12, 2.5, 2], spans: bake, draws: { specimen: 'bridgeSpecimenDeck', world: 'bridgeDeck' },
  deck: { width: 1.4, sag: 1, halfY: 0.05, mass: 14, maxSegments: 64, maxColliders: 64, margin: 0.15, owner: { id: 'bridge', name: 'Rope bridge' }, piece: 'bridge' },
}, ISLAND);
