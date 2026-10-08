/**
 * Driftwood's collectible/event feat counts come from the existing flags and emit stable SF14 ledger facts.
 * The platform Progress view reads that ledger; this runtime owns no second achievement counter store.
 * The vista bench keeps its original player pose and toast.
 */
import { SEA_GLASS_COUNT, SEA_GLASS_FLAG, SHARD_FLAGS } from './interactables';
import { QUEST_DONE } from './questLine';
import type { Adventure, AdventureWorld, AdvAnimal } from './adventure';


export function installFeats<A extends AdvAnimal>(adv: Adventure, w: AdventureWorld<A>, factCount: (id: string, total: number) => void): void {
  const { flags } = adv;
  const sync = (): void => {
    const counts = { castaway: Number(flags.has('talked:castaway')), shards: SHARD_FLAGS.filter(f => flags.has(f)).length,
      glass: flags.count(SEA_GLASS_FLAG), treasure: Number(flags.has('open:reef-treasure')), vista: Number(flags.has('used:vista-bench')),
      zipline: Number(flags.has('used:zipline')), quest: Number(flags.has(QUEST_DONE)) };
    for (const [id, total] of Object.entries(counts)) factCount(id, total);
  };
  sync();
  const offFlags = flags.onChange((f, on) => {
    if (!on || f.startsWith('plate:') || f.startsWith('lever:')) return;
    sync();
    if (f.startsWith(SEA_GLASS_FLAG) && flags.count(SEA_GLASS_FLAG) === SEA_GLASS_COUNT) w.hud.toast(`Every piece of sea glass on the island · ${SEA_GLASS_COUNT} / ${SEA_GLASS_COUNT}`);
  });

  w.scope?.onDispose(offFlags);

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
