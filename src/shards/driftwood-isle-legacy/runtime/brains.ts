import { SkirmisherBrain } from '@wildshard/engine/ai/skirmisher';
import { GuardianBrain } from '@wildshard/engine/ai/guardian';
import { PerchHunterBrain } from '@wildshard/engine/ai/perchHunter';
import { skirmisher, guardian, perchHunter } from '@wildshard/sdk/brains';
import { CRAB_BRAIN, SAILOR_BRAIN, MONKEY_BRAIN } from '../data/brains';
import { CRAB, CrabBrain } from '../species/crab';
import { SAILOR, SailorBrain } from '../species/sailor';
import { MONKEY, monkeyAttackRandom } from '../species/monkey';
import { MonkeyBrain, pickPerch, setPerch } from '../species/monkeyPolicy';
import { DRIFTWOOD_SPECIES } from '../species/install';

/** SF27: ON-only policy selection; native rigs, contact damage and attack tokens remain G51 recipes. */
export function declaredCreatureRows(): typeof DRIFTWOOD_SPECIES {
  const data = skirmisher(CRAB_BRAIN), guard = guardian(SAILOR_BRAIN), perch = perchHunter(MONKEY_BRAIN);
  type Actor = Parameters<NonNullable<typeof CRAB.think>>[0];
  type Context = Parameters<NonNullable<typeof CRAB.think>>[1];
  const brains = new WeakMap<Actor, { think: (context: Context) => void; act: (context: Context) => void }>();
  type Decide = (actor: Actor, context: Context) => void;
  function brain(actor: Actor): NonNullable<ReturnType<typeof brains.get>> {
    let value = brains.get(actor);
    if (value === undefined) {
      if (actor.kind === CRAB.kind) {
        const policy = new SkirmisherBrain(actor, data); const decide: Decide = (_actor, context) => { policy.think(context); }; value = new CrabBrain(actor, decide);
      } else if (actor.kind === SAILOR.kind) {
        const policy = new GuardianBrain(actor, guard); const decide: Decide = (_actor, context) => { policy.think(context); }; value = new SailorBrain(actor, decide);
      } else {
        const policy = new PerchHunterBrain(actor, perch);
        const decide: Decide = (_actor, context) => { policy.think({ ...context,
          attackRandom: { range: (min, max) => monkeyAttackRandom().range(min, max) },
          pickPerch: (a, min, max, away) => pickPerch(a, context, min, max, away),
          setPerch: (a, index) => { setPerch(a, context, index); },
        }); };
        value = new MonkeyBrain(actor, decide);
      }
      brains.set(actor, value);
    }
    return value;
  }
  const rows: typeof DRIFTWOOD_SPECIES = [];
  for (const row of DRIFTWOOD_SPECIES) {
    if (row.id !== CRAB.id && row.id !== SAILOR.id && row.id !== MONKEY.id) { rows.push(row); continue; }
    const declared = { ...row };
    declared.think = (actor, context) => { brain(actor).think(context); };
    declared.act = (actor, context) => { brain(actor).act(context); };
    rows.push(declared);
  }
  return rows;
}
