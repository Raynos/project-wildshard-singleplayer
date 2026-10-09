/**
 * A template copy's "[E] …" prompts inside the grid (SHARD-PLATFORM template-prompts, E435). Standalone, a shardfile
 * shard's declared interactions (`targets.interactions`: the template's hut door) become the page runtime's prompts
 * (`installDeclaredTargets`), each running its declared scene through the shard's script lane. In the grid every template
 * copy is its own bodyless regional simulation (`createShardfileSim` in `LiveGridSession.admit`), so the same rows become
 * that region's prompts here: in the region's frame (the source's own coordinates are frame-local), each scene enqueued on
 * the region's own lane for the region's player actor, so the door, its collider, its panel and the quest move exactly as
 * standalone. The page offers them only while the feet stand in the entered copy (`enteredCopy`), and they go with the
 * region (built at admission, dropped at its disposal).
 *
 * Not here: an item scene (`targets.itemActions`, the template's lantern toggle / refill) is the held item's own action;
 * a template cell holds its empty equipment (bare hands, G68), so no prompt can reach an item runtime there.
 */
import { Vector3 } from 'three';
import type { ShardRuntime } from '../shard/runtime';
import { createQuestScriptPorts } from '../quest/declared';
import type { Shardfile } from '../shardfile/schema';
import type { ShardfileSimulation } from '../shardfile/simulation';

type Interactable = ShardRuntime['interactables'][number];

/** What a copy's prompts read of its admitted region: its script lane, actor handles and player actor. */
export type CopyRegion = Pick<ShardfileSimulation, 'lane' | 'actors'> & { readonly host: { readonly player: { readonly id: string } } };

/** The copy's declared interactions as frame-local prompts on `region`'s own lane (none without a lane). */
export function copyPrompts(source: Pick<Shardfile, 'targets' | 'hooks'>, region: CopyRegion): Interactable[] {
  const lane = region.lane;
  if (lane === undefined || source.targets.interactions.length === 0) return [];
  const items = new Set((source.targets.itemActions ?? []).map((row) => row.scene));
  const scenes = createQuestScriptPorts(lane, source.hooks, region.actors), actor = region.host.player.id;
  return source.targets.interactions.filter((row) => !items.has(row.scene)).map((row) => ({
    position: new Vector3(...row.at), radius: row.radius, label: row.label, onInteract: () => { scenes.scene(row.scene, actor); },
  }));
}

/** The template copy whose prompts the page may use now: the live frame the traveller stands in, when the feet stand in
 *  that same cell (never on the road, nor mid-crossing with the feet across the seam), and it is an admitted copy. */
export function enteredCopy(state: Readonly<{ current: string | null; feetCell: string | null | undefined }>, admitted: (instance: string) => boolean): string | null {
  const { current, feetCell } = state;
  return current !== null && feetCell === current && admitted(current) ? current : null;
}
