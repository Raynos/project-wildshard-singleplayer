/**
 * Driftwood Isle's gear (E306 / E315 M5, `gear`): what the island's player holds — the wooden sword it hands out
 * (src/player/Sword.ts, `ChunkDef.weapon === 'sword'`), the iron sword found in the wreck's hold and the AR-15 from the
 * cabin (both shared, src/models/gear.ts). The viewmodels keep drawing the held ones; each card is a separate build by the
 * weapon's own builder on its own materials (src/models/gear.ts says why).
 */
import { defineModel, type ModelDef } from '../../../models/model';
import { ar15, ironSword, swordParts } from '../../../models/gear';
import { live, type RosterEntry } from '../../../models/live';

/**
 * The wooden sword: Sword.ts's low-poly rig (`buildSword('wood')`: the pale carved blade with its rounded tip, the plain
 * crossguard, the leather-wrapped grip, the dark pommel, and the two fists on the grip) — faceted vertex colours, no
 * textures. The card is the sword and the hands on it as held; the forearms are left out (`swordParts`).
 */
export const woodenSword: ModelDef<object> = defineModel<object>({
  id: 'driftwood-isle/wooden-sword', name: 'Wooden sword', category: 'gear', pipeline: 'code', file: 'src/chunks/driftwood-isle/models/gear.ts',
  defaults: {},
  build: (ctx) => swordParts(ctx, 'wood'),
});

/** the island's kit (src/main.ts): the wooden sword (1), the iron sword (2, once taken), the AR-15 (the cabin pickup) */
export const GEAR: readonly RosterEntry[] = [
  live(woodenSword, { copies: 1 }),
  live(ironSword, { copies: 1 }),
  live(ar15, { copies: 1 }),
];
