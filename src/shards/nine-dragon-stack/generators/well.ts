// The Yamen Well (dome C, E169), the partial shard's cut: its rim at the square's datum (+125 m) and the upper galleries
// down to ~+60 m, dissolving into silk mist below. Not a sheer square shaft: a NARROW CANYON (round-6 mockups B and D).
// The shaft keeps its footprint by the square (x −28…0, z −44…16) and runs on north under the Cable Deck as a 16 m
// slot (x −28…−12, z −104…−44) whose ceiling is the deck's sky screen, so the view along it from the south rim
// recedes 115 m into the mist. Both long walls carry stacked timber verandas and concrete walkways 2–6 m deep
// (well-galleries.ts), so the open gap reads 10–18 m; bridges, catwalks and a gate bridge cross it at many levels,
// sagging nets hang between the gallery fronts, the red gondola runs on its cable between two stations
// (well-bridges.ts). Neon blade signs hang out into the canyon and face the rim; lanterns, laundry, people everywhere.
// The regions are built by their own files so each can be owned on its own (well-plan.ts: the shared plan):
// well-rim.ts (the rim + the near galleries), well-mid.ts (the run north + every crossing), well-lower.ts (below SPLIT).
import type { Ctx } from '../world/ctx';
import { buildRim } from './well-rim';
import { buildMid } from './well-mid';
import { buildLower } from './well-lower';
import { WellPlan } from './well-plan';
import { WELL_RECTS } from '../world/wellBounds';

/** build the Well: the rim and near galleries, the lower levels, then the mid-shaft (its crossings tie into both) */
export function buildWell(ctx: Ctx): void {
  const plan = new WellPlan(ctx);
  buildRim(plan);
  buildLower(plan);
  buildMid(plan);
  for (const r of WELL_RECTS) ctx.map.push({ ...r, kind: 'well' });
}
