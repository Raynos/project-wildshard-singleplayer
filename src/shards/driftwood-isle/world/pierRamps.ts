/**
 * SF72 (the coordinator's pick (c), E435): Driftwood's pier and jetty sea ramps flare from the full 8 m entry socket at the
 * landing to the deck's width at their top, so the road's outer lanes walk up onto the deck instead of off the landing
 * into the sea. The old straight ramps (the deck's width all the way) stay selectable for Jake's pick as ONE Debug row,
 * pause ▸ Settings ▸ Debug ▸ "Driftwood pier ramps" (registered by ../runtime/index.ts; a reload row: the world is built
 * once). The pick commit deletes the row, this module and the losing ramp.
 */
import { jsonSlot } from '@wildshard/engine/saves/slots';

export const PIER_RAMP_PICKS = ['flared', 'straight'] as const;
export type PierRampPick = (typeof PIER_RAMP_PICKS)[number];
/** the Debug row's id (../runtime/index.ts registers it; its saved slot is `debug.plugin.driftwood-isle.<id>`) */
export const PIER_RAMP_ROW = 'pierRamps';

/** the saved pick (the row's per-device slot), flared when none is saved */
export function pierRampPick(): PierRampPick {
  const saved = jsonSlot(`debug.plugin.driftwood-isle.${PIER_RAMP_ROW}`, 'device').read();
  return PIER_RAMP_PICKS.find((choice) => choice === saved) ?? 'flared';
}
