/**
 * Driftwood's collectibles + event achievements (A4): the flags the adventure raises become Progress events
 * (src/game/Progress.ts `recordEvent`, the Driftwood table in src/game/achievements.ts). Counts are read back from
 * the flags (`recordEvent('glass', total)`), so a save made before an achievement existed still earns it on load.
 * Kill achievements (the sailor, crabs, monkeys) need nothing here — main.ts records every kill.
 *
 * The vista bench: sitting turns you to the view it was placed for and holds you there a moment.
 */
import type * as THREE from 'three';
import { SEA_GLASS_COUNT, SEA_GLASS_FLAG, SHARD_FLAGS } from '../../world/interact/driftwood';
import { QUEST_DONE } from './driftwood';
import type { Adventure, AdventureWorld } from './Adventure';

export interface ProgressSink { recordEvent: (event: string, total?: number) => void }

export function installFeats<A extends { kind: string; position: THREE.Vector3 }>(adv: Adventure, w: AdventureWorld<A>, progress: ProgressSink): void {
  const { flags } = adv;
  const sync = (): void => {
    if (flags.has('talked:castaway')) progress.recordEvent('talked', 1);
    progress.recordEvent('shard', SHARD_FLAGS.filter((f) => flags.has(f)).length);
    progress.recordEvent('glass', flags.count(SEA_GLASS_FLAG));
    if (flags.has('open:reef-treasure')) progress.recordEvent('treasure', 1);
    if (flags.has('used:vista-bench')) progress.recordEvent('vista', 1);
    if (flags.has(QUEST_DONE)) progress.recordEvent('quest', 1);
  };
  sync();
  flags.onChange((f, on) => {
    if (!on || f.startsWith('plate:') || f.startsWith('lever:')) return;
    sync();
    if (f.startsWith(SEA_GLASS_FLAG) && flags.count(SEA_GLASS_FLAG) === SEA_GLASS_COUNT) w.hud.toast(`Every piece of sea glass on the island · ${SEA_GLASS_COUNT} / ${SEA_GLASS_COUNT}`);
  });

  // the vista bench: sit → face the view (the bench's own facing), a little lift of the chin
  adv.kit.onSit = (at, yaw) => {
    const p = w.player, x = at.x + Math.sin(yaw) * 0.2, z = at.z + Math.cos(yaw) * 0.2;
    p.position.set(x, adv.floorAt(x, z), z);
    p.velocity.set(0, 0, 0);
    p.yaw = yaw + Math.PI;   // the bench faces +Z in its frame; the camera looks along −Z at yaw 0
    p.pitch = 0.04;
    w.hud.toast('You sit a while. The sea goes on and on.');
  };
}
