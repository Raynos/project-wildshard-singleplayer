/**
 * The trader's stall at Wendell's hut (E314, Jake's pick 2026-09-30: "a trader at Wendell's hut"; project/archive/
 * 2026-09-30-driftwood-loot.md): the second NPC (src/shards/driftwood-isle/models/trader.ts) stands west of the hut's front steps,
 * across the path from Wendell and his campfire, behind her counter of goods; the counter faces down the path, so you
 * see what is for sale from the campfire. Both are placed models (registered: colliders, the Model Explorer).
 *
 *   const stall = installTrader(adventure, world)   // Adventure.ts, after the spine → adventure.trader
 *   stall.shop = { open, isOpen, close }            // the loot (src/game/loot/runtime.ts) hands her the shop screen
 *
 * Her prompt (E314 stage 2): "Trade with Maren" in front of the counter (the touch USE band) once a shop is attached; it
 * opens the shop screen (src/game/loot/ui/ShopPanel.ts). Walking off the counter closes it. Wendell stays the quest giver; she only
 * trades, so she has no dialogue.
 */
import * as THREE from 'three';
import { modelContext } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { trader, tradeCounter, traderOf, traderRigOf } from '../models/trader';
import type { Trader } from '../npc/Trader';
import type { Adventure, AdventureWorld, AdvAnimal } from './adventure';
import { ownEnteredTree } from './Spine';

/** her island name (the prompt, the shop's title and line) */
export const TRADER_NAME = 'Maren';

export interface TraderShop { open: () => void; close: () => void; readonly isOpen: boolean }
export interface TraderStall {
  trader: Trader;
  /** the counter's front, where the prompt sits (the player stands here to trade) */
  readonly at: THREE.Vector3;
  /** the shop screen; null = no prompt (a shard or build without the shop) */
  shop: TraderShop | null;
}

/** hut local frame (the door faces −z; the pier path comes up from −z): her feet, turned toward the path and the fire */
const FEET = { x: -3.3, z: -7.8, yaw: Math.PI - 0.5 };
/** metres from her feet to the counter's centre, straight ahead of her */
const COUNTER_AHEAD = 0.72;
/** metres from her feet to where you stand to trade (across the counter), and the prompt's reach from there */
const TRADE_AHEAD = 1.9, TRADE_R = 2.8;
/** the view's tilt while the shop is open (rad, down): her head at ~30 % of a portrait screen, over the sheet */
const SHOP_PITCH = -0.32;

export function installTrader<A extends AdvAnimal>(adv: Adventure, w: AdventureWorld<A>): TraderStall | null {
  const feet = adv.place({ poi: 'hut', x: FEET.x, z: FEET.z, yaw: FEET.yaw });
  const fx = Math.sin(feet.yaw), fz = Math.cos(feet.yaw);
  const cx = feet.x + fx * COUNTER_AHEAD, cz = feet.z + fz * COUNTER_AHEAD;
  const ctx = modelContext(w.sky);
  const registry = w.registry ?? undefined;
  // SF57: she, her counter, their pieces and colliders belong to this entry, not the page (a re-entered borrowed home
  // installs them again; after the adventure's awaits the ambient owner is the page's)
  const scope = w.scope;
  const entered = <P extends { readonly object: THREE.Object3D }>(placed: () => P): P => {
    if (scope === undefined) return placed();
    const out = scope.run(placed);
    ownEnteredTree(out.object, scope);
    return out;
  };
  const npc = entered(() => place(trader, [{ x: feet.x, y: feet.y, z: feet.z, yaw: feet.yaw }], { ctx, draw: 'single', ...(registry ? { registry } : {}), piece: { id: 'trader', name: 'The trader' } }));
  const counter = entered(() => place(tradeCounter, [{ x: cx, y: adv.floorAt(cx, cz), z: cz, yaw: feet.yaw }], { ctx, draw: 'single', ...(registry ? { registry } : {}),
    piece: { id: 'trade-counter', name: 'The trader\'s counter', solidFloor: false } }));
  const t = traderOf(npc.object);
  if (t === null) return null;
  const npcRig = traderRigOf(npc.object);
  w.scope?.onDispose(() => { npcRig?.dispose(); });
  t.companions.push(counter.object);
  const ax = feet.x + fx * TRADE_AHEAD, az = feet.z + fz * TRADE_AHEAD;
  const at = new THREE.Vector3(ax, adv.floorAt(ax, az) + 1.35, az);
  const stall: TraderStall = { trader: t, at, shop: null };
  let pitchBefore = 0, wasOpen = false;
  const prompt: Interactable = {
    position: at,
    get radius() { return stall.shop === null || stall.shop.isOpen ? 0 : TRADE_R; },
    label: `Trade with ${TRADER_NAME}`,
    onInteract: () => {
      if (!stall.shop || stall.shop.isOpen) return;
      // face her and look down a little, so she and her counter sit in the gap above the shop's sheet (board 5 C);
      // the view's tilt comes back when the shop closes
      const p = w.player.position, her = t.position;
      w.player.yaw = Math.atan2(-(her.x - p.x), -(her.z - p.z));
      pitchBefore = w.player.pitch; w.player.pitch = SHOP_PITCH;
      stall.shop.open(); t.offer(); wasOpen = true;
    },
  };
  w.prompts.push(prompt);
  w.game.onUpdate((dt, time) => {
    npcRig?.update(dt, time, w.player.position);
    // walking off the counter closes the shop (as a talk closes, core.ts NpcTalk)
    if (stall.shop?.isOpen === true && w.player.position.distanceTo(at) > TRADE_R + 2.5) stall.shop.close();
    if (wasOpen && stall.shop?.isOpen !== true) { wasOpen = false; w.player.pitch = pitchBefore; }
  }, 'shard.driftwood-isle.installTrader');
  return stall;
}
