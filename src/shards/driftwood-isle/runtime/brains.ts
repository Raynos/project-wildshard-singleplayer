import { SkirmisherBrain } from '@wildshard/engine/ai/skirmisher';
import { skirmisher } from '@wildshard/sdk/brains';
import { CRAB_BRAIN } from '../data/brains';
import { CRAB, CrabBrain } from '../species/crab';
import { DRIFTWOOD_SPECIES } from '../species/install';

/** SF27: ON-only policy selection; native rigs, contact damage and attack tokens remain G51 recipes. */
export function declaredCreatureRows(): typeof DRIFTWOOD_SPECIES {
  const data = skirmisher(CRAB_BRAIN);
  type Actor = Parameters<NonNullable<typeof CRAB.think>>[0];
  const brains = new WeakMap<Actor, CrabBrain>();
  function brain(actor: Actor): CrabBrain {
    let value = brains.get(actor);
    if (value === undefined) {
      const policy = new SkirmisherBrain(actor, data);
      value = new CrabBrain(actor, (_actor, context) => { policy.think(context); }); brains.set(actor, value);
    }
    return value;
  }
  const rows: typeof DRIFTWOOD_SPECIES = [];
  for (const row of DRIFTWOOD_SPECIES) {
    if (row.id !== CRAB.id) { rows.push(row); continue; }
    const declared = { ...row };
    declared.think = (actor, context) => { brain(actor).think(context); };
    declared.act = (actor, context) => { brain(actor).act(context); };
    rows.push(declared);
  }
  return rows;
}
