import { BRAZIERS } from './layout';
import { fireRows, lampRows, COOKFIRE, WAYMARK_FIRE, KEEPER_LAMP, SIGNAL_FIRE, type FireSize } from './rows/fire';

/** Shared effect attachments; geometry and file access stay with the native bake. */
export interface PlaceEffects {
  fires: { part: string; rows: ReturnType<typeof fireRows>; pool: string | null }[];
  lamps: { part: string; rows: ReturnType<typeof lampRows>; pool: string }[];
}
export function placeEffects(): Record<'caravan' | 'tower' | 'well', PlaceEffects> & { braziers: PlaceEffects[] } {
  const lamp = (part: string, glow: number, pool: string) => ({ part, rows: lampRows(glow), pool });
  const fire = (part: string, size: FireSize, pool: string | null) => ({ part, rows: fireRows(size), pool });
  return {
    caravan: { fires: [fire('live.cook', COOKFIRE, 'pool-cook')], lamps: [lamp('live.lamp', 0.5, 'pool-caravan-lamp')] },
    well: { fires: [], lamps: [] },
    tower: { fires: [fire('live.lamp-flame', KEEPER_LAMP, null), fire('live.fire', SIGNAL_FIRE, null)], lamps: [lamp('live.keeper-lamp', 1.1, 'pool-keeper-lamp')] },
    braziers: BRAZIERS.map((_, index) => ({ fires: [fire('fire', WAYMARK_FIRE, `pool-brazier-${String(index)}`)], lamps: [] })),
  };
}
