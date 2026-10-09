import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import type { AchievementDef } from '@wildshard/game/achievements';

/** The kill feats' fixed-step adapter id (their counts are continuation). */
export const KILLS_STEP = 'driftwood.kills';
/** The sailor's death drops the hold key (quest/Spine.ts's kill hook): the wreck's puzzle and the iron sword's guard read it. */
export const SAILOR_DEAD_FLAG = 'dead:sailor';

/** One body of the island as the kill hooks read it: its kind and its pipeline actor. */
export interface KilledBody { readonly kind: string; readonly actor: { readonly combatActor: () => unknown } | null }
const count = v.pipe(v.number(), v.integer(), v.minValue(0));

/**
 * Driftwood's kill hooks in a renderer-free host (SF72), as the page's adventure files them on 'actor.died'
 * (quest/adventure.ts `w.onDeath`): the drowned sailor's death sets `dead:sailor` (quest/Spine.ts; the captain's
 * `dead:captain` is runtime/captain.ts's), and every kill of a feat's kind counts toward it (quest/facts.ts
 * `bindDriftwoodFacts.kill`): each new count up to the feat's total emits the stable ledger fact `driftwood.<id>` for
 * entity `<id>:<n>` (data/ledger.ts grants the achievement at its threshold). The counts start at 0 in a fresh run (the
 * page starts from the profile's ledger) and are exact continuation.
 */
export function installDriftwoodKills(host: SimHost, feats: readonly AchievementDef[], roster: () => readonly KilledBody[], fact: (name: string, entity: string) => void): { readonly count: (id: string) => number } {
  const kills = feats.filter(feat => feat.kind !== undefined), counts = new Map(kills.map(feat => [feat.id, 0]));
  const Saved = v.strictObject(Object.fromEntries(kills.map(feat => [feat.id, v.pipe(count, v.maxValue(feat.count))])));
  host.events.on('actor.died', ({ actor }) => {
    const body = roster().find(b => b.actor?.combatActor() === actor);
    if (body === undefined) return;
    if (body.kind === 'sailor') host.flags.set(SAILOR_DEAD_FLAG);
    kills.forEach(feat => {
      const n = counts.get(feat.id) ?? 0;
      if (feat.kind !== body.kind || n >= feat.count) return;
      counts.set(feat.id, n + 1);
      fact(`driftwood.${feat.id}`, `${feat.id}:${String(n + 1)}`);
    });
  }, host.scope);
  // the counts change only on a death: the step carries them as continuation and does nothing per tick
  host.onStep(KILLS_STEP, () => undefined, {
    snapshot: () => Object.fromEntries(counts),
    restore: value => { const saved = v.parse(Saved, value); kills.forEach(feat => { counts.set(feat.id, saved[feat.id] ?? 0); }); },
  });
  return { count: id => counts.get(id) ?? 0 };
}
