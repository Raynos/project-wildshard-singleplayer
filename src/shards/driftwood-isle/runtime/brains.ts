import { CrabBrain } from '../species/crab';
import { SailorBrain } from '../species/sailor';
import { monkeyAttackRandom } from '../species/monkey';
import { MonkeyBrain, pickPerch, setPerch } from '../species/monkeyPolicy';
import { DRIFTWOOD_SPECIES } from '../species/install';
import { DRIFTWOOD_ENEMY_SPECIES } from '../data/enemySpecies';
import { driftwoodSpeciesBrains } from './speciesBrains';

/** SF27: species-row policy selection; native rigs, contact damage and attack tokens remain G51 recipes. */
export function declaredCreatureRows(): typeof DRIFTWOOD_SPECIES {
  type Factory = NonNullable<Parameters<typeof driftwoodSpeciesBrains.bind>[1]>;
  type Actor = Parameters<Factory>[0];
  type Context = Parameters<ReturnType<Factory>['think']>[0];
  const rows: typeof DRIFTWOOD_SPECIES = [];
  for (let catalogueIndex = 0; catalogueIndex < 4; catalogueIndex++) {
    const row = DRIFTWOOD_SPECIES[catalogueIndex];
    if (row === undefined) throw new Error('Incomplete Driftwood species catalogue');
    const data = DRIFTWOOD_ENEMY_SPECIES.find(candidate => candidate.kind === row.kind);
    if (data === undefined) { rows.push(row); continue; }
    const bound = driftwoodSpeciesBrains.bind(row.kind, (actor, decision) => {
      switch (decision.archetype) {
        case 'skirmisher': return new CrabBrain<Actor, Context>(actor, (_actor, context) => { decision.policy.think(context); });
        case 'guardian': return new SailorBrain<Actor, Context>(actor, (_actor, context) => { decision.policy.think(context); });
        case 'perch-hunter': return new MonkeyBrain<Actor, Context>(actor, (_actor, context) => { decision.policy.think({ ...context,
          attackRandom: { range: (min, max) => monkeyAttackRandom().range(min, max) },
          pickPerch: (a, min, max, away) => pickPerch(a, context, min, max, away),
          setPerch: (a, index) => { setPerch(a, context, index); },
        }); });
        default: throw new Error('Unknown admitted Driftwood enemy decision');
      }
    });
    rows.push({ ...data, ...bound });
  }
  return rows;
}
