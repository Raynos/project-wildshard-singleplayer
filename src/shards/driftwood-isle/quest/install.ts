import { entryOwner } from '@wildshard/game/shardfile/entryOwners';
import type { ShardContext } from '@wildshard/game/shard/context';
import { driftwoodWorld } from '../world/build';
import { bindClientPlaceSets } from '@wildshard/game/shardfile/clientPlaceSets';
import type { QuestPageComposition as Adventure } from '@wildshard/game/quest/pageComposition';
import type { QuestPageCompositionRows } from '@wildshard/format/questPageComposition';

/** Finish the entered quest after its compiled composition has published. */
export async function installDriftwoodAdventure(ctx: ShardContext): Promise<Adventure> {
  const shell = ctx.game.runtime;
  const world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Driftwood adventure requires the play host');
  const d = driftwoodWorld(shell);
  const rows = await ctx.product.json<QuestPageCompositionRows>('quests/page-composition.json');
  const adventure = entryOwner(ctx.scope, 'quest', rows.id);
  installBridgeSway(ctx, { ...rows.sway, system: rows.systems.sway, before: rows.systems.before });
  const placed = [...entryOwner(ctx.scope, 'placed', 'piers.world-0'), d.boat.placed,
    ...['piers.world-1', 'piers.world-2', 'piers.world-3'].flatMap(id => entryOwner(ctx.scope, 'placed', id)), ...entryOwner(ctx.scope, 'placed', 'hut'), ...entryOwner(ctx.scope, 'placed', 'lookout'), d.shrine.placed, d.bushes.placed, d.palms.placed, d.rocks.placed, d.bridge.placed,
    ...d.trailside.placed, ...d.cover.placed, ...d.wreck.placed, ...d.cove.placed, adventure.zipline?.placed, ...adventure.kit.placed];
  // the named places' Sets: the client plan's `world.sets` rows (Wreck Cove's is the whole wreck and cove)
  await bindClientPlaceSets(ctx, new Map([['wreck', [...d.wreck.placed, ...d.cove.placed]]]), placed.filter(p => p !== undefined));
  return adventure;
}

/** G532(3): the rope deck remains listed shard view code until WASM-HOST. */
export interface BridgeSwayRows {
  readonly piece: string; readonly system: string; readonly before: readonly string[];
  readonly height: number; readonly ease: number; readonly threshold: number;
  readonly rate: number; readonly speed: number; readonly rollHz: number;
  readonly roll: number; readonly dipHz: number; readonly dip: number;
}

/** Keep the shipping camera projection on the entered bridge's actual floor. */
export function installBridgeSway(ctx: ShardContext, rows: BridgeSwayRows): void {
  const world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('Rope deck view requires its entered world');
  const bridge = world.registry.get(rows.piece);
  if (bridge === undefined) return;
  let sway = 0, bt = 0;
  ctx.system({ id: rows.system, phase: 'update', before: [...rows.before], run: dt => {
    const p = world.player.position, f = bridge.floor?.(p.x, p.z);
    const on = f !== undefined && Math.abs(p.y - f) < rows.height;
    sway += ((on ? 1 : 0) - sway) * Math.min(1, dt * rows.ease);
    if (sway < rows.threshold) return;
    bt += dt * (rows.rate + Math.hypot(world.player.velocity.x, world.player.velocity.z) * rows.speed);
    world.game.camera.rotation.z += Math.sin(bt * rows.rollHz) * rows.roll * sway;
    world.game.camera.position.y += Math.sin(bt * rows.dipHz) * rows.dip * sway;
  } });
}
