import { parseToonLook } from '@wildshard/format/toonLook';
import held from '../data/heldArms.json' with { type: 'json' };
import puffs from '../data/cumulusPuffs.json' with { type: 'json' };
import DRIFTWOOD_SKY_DAY from '../data/skyDay.json' with { type: 'json' };
import MIDDAY_SKY_ROWS from '../data/skyPalette.json' with { type: 'json' };
import { RAMP_FOG } from './toonLook';
import { GROUND_LOOK } from './groundLook';
import { KIT_LENDS } from './kitLook';
import { SKY_DOME_LOOK, SKY_CLOUD_LOOK } from './skyLook';
import { DRIFTWOOD_ASSET_NAMES } from './assets';

function draw(id: string): string {
  const file = DRIFTWOOD_ASSET_NAMES[id];
  if (file === undefined) throw new Error(`Missing toon ground draw: ${id}`);
  return file;
}
/** Build-only composition of authored rows; the admitted host receives no native owner or callback. */
export const TOON_LOOK = parseToonLook({
  id: 'driftwood.toon', lighting: held.look.lighting,
  fog: { ...RAMP_FOG, order: 200 },
  shadows: { rig: 'phoneSplits', filter: 'tent', fade: true, normalBias: .14, radius: .6, texelBias: 'phone', depth16: 'phone' },
  ground: { materials: GROUND_LOOK.materials, files: { ground: draw('draw:ground:ground'), slab: draw('draw:ground:slab') }, kit: KIT_LENDS },
  sky: { day: DRIFTWOOD_SKY_DAY, cycleSeconds: 48 * 60, name: 'driftwood-isle', channels: 'driftwood.sky',
    dome: { look: SKY_DOME_LOOK, radius: 2200, segments: [48, 24], order: -20 },
    clouds: { look: SKY_CLOUD_LOOK, order: -15, puffs }, midday: { zenith: MIDDAY_SKY_ROWS.zenith, horizon: MIDDAY_SKY_ROWS.horizon, cloudLit: MIDDAY_SKY_ROWS.cloudLit, sunGlow: MIDDAY_SKY_ROWS.sunGlow },
    environment: { near: 1, far: 3000 }, crisp: 1 },
});
