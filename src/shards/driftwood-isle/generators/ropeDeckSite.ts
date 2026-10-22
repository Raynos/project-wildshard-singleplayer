import type { RopeDeckSiteRows } from '@wildshard/format/ropeDeckSite';
import bake from '../data/bridgeBake.json' with { type: 'json' };

/** The original card, rest spans and draw slots, as build-time construction data. */
export function driftwoodRopeDeckSite(): RopeDeckSiteRows { return {
  model: { id: 'driftwood-isle/rope-bridge', name: 'Rope bridge', category: 'buildings', pipeline: 'code', file: 'src/shards/driftwood-isle/generators/ropeDeckSite.ts', surface: 'planks' },
  specimen: 1, loading: [12, 2.5, 2], spans: bake, draws: { specimen: 'bridgeSpecimenDeck', world: 'bridgeDeck' },
  deck: { width: 1.4, sag: 1, halfY: 0.05, mass: 14, maxSegments: 64, maxColliders: 64, margin: 0.15, owner: { id: 'bridge', name: 'Rope bridge' }, piece: 'bridge' },
}; }
