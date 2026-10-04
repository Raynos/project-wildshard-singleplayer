import type { Vector3 } from 'three';
import type { ShardContext } from '@wildshard/game/shard/context';

/** the world updater the island's work ran inside until E357 S4.1; it still runs the hands, the horizon and the enemies */
const BEFORE = ['main.world'];

interface Ticks { update: (dt: number) => void }
/** what the systems tick: the world build's parts (./build.ts DriftwoodWorld), or none of one */
export interface IslandParts<Deck extends { readonly awake: boolean }> {
  ocean: Ticks | null; boat: (Ticks & { readonly moverDriven?: boolean }) | null; palms: Ticks | null; seabed: Ticks | null; cove: Ticks | null; shrine: Ticks | null;
  gulls: { update: (dt: number, player: Vector3) => void } | null;
  bridge: { setPoses: (deck: Deck, alpha: number) => void } | null; bridgeDeck: Deck | null;
}
/** what they read off the bootstrapped world each frame: the player's position, the fixed step's interpolation */
export interface IslandView { readonly player: { readonly position: Vector3 }; readonly game: { readonly alpha: number } }

/**
 * The island's per-frame work (E357 S4.1, 08 §4), in the order main.ts's world updater ran it before the hands: the sea
 * (its swell clock), the moored boat, the palms (the shared sway wind), the gulls, the rope bridge's planks on its
 * jointed deck, the seabed, the cove and the shrine. Each is a level system, registered after the world build's own
 * (cover, Blender island), so the frame's order is unchanged.
 */
export function islandSystems<Deck extends { readonly awake: boolean }>(ctx: ShardContext, view: IslandView, parts: IslandParts<Deck>): void {
  const { ocean, boat, palms, gulls, bridge, bridgeDeck, seabed, cove, shrine } = parts;
  if (ocean) ctx.system({ id: 'shard.driftwood.ocean', phase: 'update', before: BEFORE, run: (dt) => { ocean.update(dt); } });
  if (boat && !boat.moverDriven) ctx.system({ id: 'shard.driftwood.boat', phase: 'update', before: BEFORE, run: (dt) => { boat.update(dt); } });
  if (palms) ctx.system({ id: 'shard.driftwood.palms', phase: 'update', before: BEFORE, run: (dt) => { palms.update(dt); } });
  if (gulls) ctx.system({ id: 'shard.driftwood.gulls', phase: 'update', before: BEFORE, run: (dt) => { gulls.update(dt, view.player.position); } });
  if (bridge && bridgeDeck) ctx.system({ id: 'shard.driftwood.bridge.pose', phase: 'update', before: BEFORE, run: () => { if (bridgeDeck.awake) bridge.setPoses(bridgeDeck, view.game.alpha); } });
  if (seabed) ctx.system({ id: 'shard.driftwood.seabed', phase: 'update', before: BEFORE, run: (dt) => { seabed.update(dt); } });
  if (cove) ctx.system({ id: 'shard.driftwood.cove', phase: 'update', before: BEFORE, run: (dt) => { cove.update(dt); } });
  if (shrine) ctx.system({ id: 'shard.driftwood.shrine', phase: 'update', before: BEFORE, run: (dt) => { shrine.update(dt); } });
}
