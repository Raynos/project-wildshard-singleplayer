/**
 * The trader's stall at Wendell's hut (E314, Jake's pick 2026-09-30: "a trader at Wendell's hut"; docs/plans/
 * DRIFTWOOD-LOOT.md): the second NPC (src/chunks/driftwood-isle/models/trader.ts) stands west of the hut's front steps,
 * across the path from Wendell and his campfire, behind her counter of goods; the counter faces down the path, so you
 * see what is for sale from the campfire. Both are placed models (registered: colliders, the Model Explorer).
 *
 *   installTrader(adventure, world)   // Adventure.ts, after the spine
 *
 * No shop yet: no prompt, no dialogue (the shop screen is E314's next piece). `stall.trader` is the NPC it will talk to.
 */
import { modelContext } from '../../models/model';
import { place } from '../../models/place';
import { trader, tradeCounter, traderOf } from '../../chunks/driftwood-isle/models/trader';
import type { Trader } from '../../entities/npc/Trader';
import type { Adventure, AdventureWorld, AdvAnimal } from './Adventure';

export interface TraderStall { trader: Trader }

/** hut local frame (the door faces −z; the pier path comes up from −z): her feet, turned toward the path and the fire */
const FEET = { x: -3.3, z: -7.8, yaw: Math.PI - 0.5 };
/** metres from her feet to the counter's centre, straight ahead of her */
const COUNTER_AHEAD = 0.72;

export function installTrader<A extends AdvAnimal>(adv: Adventure, w: AdventureWorld<A>): TraderStall | null {
  const feet = adv.place({ poi: 'hut', x: FEET.x, z: FEET.z, yaw: FEET.yaw });
  const fx = Math.sin(feet.yaw), fz = Math.cos(feet.yaw);
  const cx = feet.x + fx * COUNTER_AHEAD, cz = feet.z + fz * COUNTER_AHEAD;
  const ctx = modelContext(w.sky);
  const registry = w.registry ?? undefined;
  const npc = place(trader, [{ x: feet.x, y: feet.y, z: feet.z, yaw: feet.yaw }], { ctx, draw: 'single', ...(registry ? { registry } : {}), piece: { id: 'trader', name: 'The trader' } });
  const counter = place(tradeCounter, [{ x: cx, y: adv.floorAt(cx, cz), z: cz, yaw: feet.yaw }], { ctx, draw: 'single', ...(registry ? { registry } : {}),
    piece: { id: 'trade-counter', name: 'The trader\'s counter', solidFloor: false } });
  const t = traderOf(npc.object);
  if (t === null) return null;
  t.companions.push(counter.object);
  w.game.onUpdate((dt, time) => { t.update(dt, time, w.player.position); });
  return { trader: t };
}
