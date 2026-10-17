/**
 * The entry road deck (G170, SHARD-PLATFORM SF46; Jake's C3-R2-C1 pick: "road decks over the water"): with G164's world
 * lowered, each of Driftwood's four midpoint entries is an asphalt road deck at road height over the sea, not a floating
 * plane. One copy per entry (world/build.ts places them), in its own frame: the cell edge's midpoint at the origin,
 * +Z running in, X across, the asphalt's top at y = 0.
 *
 * Baked offline (generators/entryDeckGeometry.ts, the fixed-model templates `entry-deck-*`): the slab, its fascia lips and edge
 * lines and three concrete bents, in the road's vertex colours, on the kit's still material, no shadow casting. No
 * colliders here: the socket's floor is the platform's (`installEntrySockets`) and the inner `LANDING_RUN` is the
 * shardfile's declared landing (world/sea.ts), installed as declared by the world build.
 */
import { defineModel } from '@wildshard/engine/models/model';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { ENTRY_DECK_GEOMETRY } from '../boot/modelGeometry';

export interface EntryDeckParams {
  /** how far in from the cell edge the deck runs, metres (the 15 m socket and its landing) */
  readonly run: number;
  /** the seabed under the columns, own y (they stand on it) */
  readonly bed: number;
}

/** the Explorer's seabeds pick their own bake; the world's entries share the world's */
const deckOf = (p: EntryDeckParams): keyof typeof ENTRY_DECK_GEOMETRY => p.bed === -6 ? 'deep' : p.bed === -2.5 ? 'shallow' : 'world';

export const entryDeck = defineModel<EntryDeckParams>({
  id: 'driftwood-isle/entry-deck', name: 'Entry road deck', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/runtime/models/entryDeck.ts', surface: 'stone',
  defaults: { run: 16.5, bed: -6 },
  variants: [
    { id: 'deep', label: 'Over deep water', params: {} },
    { id: 'shallow', label: 'Over the shallows', params: { bed: -2.5 } },
  ],
  seed: 0xdec4,
  // the baked deck (generators/entryDeckGeometry.ts): placed only by the world build, after it loads the island's templates
  build: (ctx, p) => [{ geometry: ENTRY_DECK_GEOMETRY[deckOf(p)].copy(), material: lowPolyLookMaterial(ctx.sky, 'still'), castShadow: false, receiveShadow: true }],
});
