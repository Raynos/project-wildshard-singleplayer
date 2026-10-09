/**
 * Driftwood Isle's gear (E306 / E315 M5, `gear`): what the island's player holds — the castaway's arms with the wooden
 * sword it hands out and with the iron sword found in the wreck's hold (E334: both swords on the same skinned arms,
 * public/assets/models/driftwood-fp/fp-arms.glb, played by src/game/systems/viewmodel/rigArms.ts through ../fpArms.ts); no rifle slot on a
 * sword shard (E333). The viewmodels keep drawing the held ones; each card is its own skeleton clone of the rig's one parse
 * (the same geometry), on its own materials, standing in the idle's first pose.
 */
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { live, type RosterEntry } from '@wildshard/engine/models/live';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';

/** the rig's rough size (m, camera space) for the loading box */
const SIZE = [0.7, 0.5, 0.8] as const;

/**
 * The wooden sword in the castaway's hands (Jake's board-2 A, art/driftwood-fp/round-1-remaster/): sun-browned hands with
 * the fingers round a hemp-cord grip, patched linen sleeves rolled to mid-forearm, the empty off hand in frame; modelled in
 * Blender round Nine Dragon's round-13 skeleton (scripts/blender/driftwood-isle/fp-arms/) — flat facets, vertex colour, no
 * textures.
 */
export const woodenSword: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/wooden-sword', name: 'Arms: wooden sword', category: 'gear', pipeline: ['blender', 'code'], file: 'src/shards/driftwood-isle/models/gear.ts',
  defaults: {},
  build: (ctx) => loadingSpecimen(woodenSword.id, SIZE, async () => (await import('../fpArms')).castawaySpecimen(ctx.sky, 'wood')),
});

/** The iron sword on the same arms (board-2 A2): the steel blade and the dark iron guard, the same hemp-cord grip. */
export const castawayIronSword: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/iron-sword', name: 'Arms: iron sword', category: 'gear', pipeline: ['blender', 'code'], file: 'src/shards/driftwood-isle/models/gear.ts',
  defaults: {},
  build: (ctx) => loadingSpecimen(castawayIronSword.id, SIZE, async () => (await import('../fpArms')).castawaySpecimen(ctx.sky, 'iron')),
});

/** the island's kit (src/main.ts): the wooden sword (1), the iron sword (2, once taken) */
export const GEAR: readonly RosterEntry[] = [
  live(woodenSword, { copies: 1 }),
  live(castawayIronSword, { copies: 1 }),
];
