/**
 * Driftwood's sky backdrop (E357 S4.3 steps 2 and 5, 08 §6.3 B; it was Sky.ts's `setupStylized`, the stylized clock's
 * wiring and DayNight.ts's keyframe application): no HDRI at all — the stylized gradient dome + faceted cumulus
 * (stylizedSky.ts) is the background, a PMREM of the dome is the (specular-only, toon.ts) environment, re-rendered as the
 * day / night clock moves on, and the sun starts where the clock puts it.
 * SHARD-PLATFORM M3: the backdrop and its clock are the SDK faceted day (@wildshard/sdk/looks/facetedDayBackdrop); the
 * clock's keys, arcs and curves are data (data/skyDay.ts, through dayKeys.ts).
 *
 *   ?tod=0.5      // start phase (default 0.2 of the day: mid-morning, the sun 36° up in the ESE)
 *   ?clock=120    // cycle length in seconds (default 2880 = 48 min) — for testing the whole loop quickly
 *   Settings ▸ Time of day (E55, `setting('time')`): park the sun at a fixed phase (midday / golden / sunset / night) or
 *   'live' to run the clock; ?tod / ?clock win
 */
import type { SkyBackdropFactory } from '@wildshard/engine/render/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { facetedDayBackdrop } from '../looks/facetedDayBackdrop';
import { SKY_CLOUD_LOOK, SKY_DOME_LOOK } from '../const';
import { DRIFTWOOD_FACETED_DAY } from '../../look/dayKeys';
import { MIDDAY_SKY } from './stylizedSky';
import { SECTIONS } from '../sections';
import { dayLight, rampFog } from './toon';

/** the whole cycle in seconds (E147, the user: "72 minutes is too big … 48 is good"; it was 24 min, as BotW's) */
const CYCLE_S = 48 * 60;

/** The backdrop over the island's built output: its sky graphs compile from the product's look materials. */
export const stylizedBackdrop = (product: ShardProduct): SkyBackdropFactory => facetedDayBackdrop({
  name: 'driftwood-isle', day: DRIFTWOOD_FACETED_DAY, sky: { looks: { source: product.shardfile, dome: SKY_DOME_LOOK, clouds: SKY_CLOUD_LOOK }, palette: MIDDAY_SKY, puffs: product.section('custom/cumulusPuffs', SECTIONS) }, light: dayLight, fog: rampFog, cycleSeconds: CYCLE_S,
});
