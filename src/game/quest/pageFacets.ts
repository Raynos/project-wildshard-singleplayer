/** A quest page's optional facets (G565): its ridden mover, its collections and its full map, each from admitted rows. */
import * as THREE from 'three';
import * as v from 'valibot';
import { QuestPageCollectionsSchema, QuestPageMapSchema, QuestPageMoverSchema } from '@wildshard/format/questPageFacets';
import type { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import type { StingName } from '@wildshard/engine/audio/Music';
import { INTERACT_SOUNDS } from '@wildshard/engine/audio/gen';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import { MoverRuntime } from '../plugin/mover';
import type { ShardContext } from '../plugin/context';
import type { SceneHandles } from '../shardfile/sceneHandles';
import { forestPage } from '../shardfile/forestPage';
import type { QuestChapter } from './chapter';

function entered(ctx: ShardContext) {
  const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
  if (runtime === undefined || world === undefined || world === null || play === undefined || play === null) throw new Error('Quest page facet requires entered play services');
  return { runtime, world, play };
}

/** Enter the page's declared mover on its scene mesh; `update` (the page's quest system) presents each ride transition:
 *  the held weapons stow while riding, the rest stand-in hides while the mover is away, boarding sounds, hints toast. */
export async function installPageMover(ctx: ShardContext, input: unknown, ports: { readonly scenes: SceneHandles; readonly flags: Flags;
  readonly sfx: Pick<InteractSfx, 'interact'> }): Promise<{ readonly motion: MoverRuntime; readonly update: () => void }> {
  const rows = v.parse(QuestPageMoverSchema, input), { runtime, world, play } = entered(ctx);
  const board = INTERACT_SOUNDS.find(sound => sound === rows.board.sound);
  if (board === undefined) throw new Error(`Unknown mover boarding sound: ${rows.board.sound}`);
  const motion = await MoverRuntime.enter(ctx, world, ctx.product.shardfile.movers, rows.binding,
    { [rows.target]: { group: ports.scenes.mesh(rows.mesh) } }, { flags: ports.flags, prompts: runtime.interactables });
  const update = (): void => {
    for (const event of motion.takeRideTransitions(rows.id)) {
      play.weapons.visible = !event.riding; play.weapons.setEnabled(!event.riding);
      const rest = ports.scenes.object(rows.rest);
      if (event.riding) rest.visible = false;
      if (event.arrived === -1) rest.visible = true;
      if (event.riding) {
        const at = motion.data.find(row => row.id === rows.id)?.at; if (at === undefined) throw new Error('Missing mover rest pose');
        ports.sfx.interact(board, new THREE.Vector3(at.x, at.y, at.z), { gain: rows.board.gain });
      }
      if (event.hint !== undefined) play.hud.toast(event.hint);
    }
  };
  return { motion, update };
}

/** The page kit's calls for its collections: each event shows the count chip, each complete event runs its page action
 *  (the page's `action`), a pickup plays its sting (the play music's `sting`). */
export function pageCollectionCalls(input: unknown, ports: { readonly flags: Pick<Flags, 'count'>;
  readonly chip: () => { show: (row: { label: string; n: number; of: number }) => void };
  readonly action: (event: string) => (e: InteractEvent) => void; readonly sting: (name: StingName) => void }): Map<string, (e: InteractEvent) => void> {
  const rows = v.parse(QuestPageCollectionsSchema, input);
  const calls = new Map<string, (e: InteractEvent) => void>(rows.rows.flatMap((row): [string, (e: InteractEvent) => void][] => [
    [row.event, (): void => { ports.chip().show({ label: row.label, n: ports.flags.count(row.prefix), of: row.names.length }); }],
    [row.completeEvent, ports.action(row.completeEvent)],
  ]));
  const pickup = rows.pickup;
  if (pickup !== undefined) calls.set(pickup.event, () => { ports.sting(pickup.sting); });
  return calls;
}

/** Publish the page's pins to the full map with its policy, name its zones and lay the forest's ground features. */
export function installPageMap(ctx: ShardContext, input: unknown, chapter: Pick<QuestChapter, 'publishMap'>): void {
  const rows = v.parse(QuestPageMapSchema, input), { world, play } = entered(ctx);
  chapter.publishMap(rows.publish);
  play.fullMap.setZones(rows.zones);
  if (rows.features !== undefined) play.fullMap.setFeatures({ trees: world.forest.trees, roofs: forestPage(ctx.scope, rows.features.forest).cabins.roofs });
}
