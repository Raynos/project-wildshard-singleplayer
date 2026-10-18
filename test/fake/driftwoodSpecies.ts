import { Scope } from '../../src/engine/app/scope';
import { MonkeyBinding } from '../../src/shards/driftwood-isle/species/monkeyBinding';
import { RETURN_PROGRAM } from '../../src/shards/driftwood-isle/generators/returnProgram';
import { MONKEY_CLIPS } from '../../src/shards/driftwood-isle/generators/monkeyClips';
import type { SpeciesRow } from '../../src/engine/ai/species';
import { driftwoodSpeciesRows } from '../../src/shards/driftwood-isle/creatures/rows';
import { DRIFTWOOD_ENEMY_PROGRAM } from '../../src/shards/driftwood-isle/generators/speciesPrograms';

/** Test-only authored intake; shipping consumers bind the verified product section. */
export const DRIFTWOOD_SPECIES = driftwoodSpeciesRows(DRIFTWOOD_ENEMY_PROGRAM, new MonkeyBinding({ clips: MONKEY_CLIPS, program: RETURN_PROGRAM }, new Scope('fixture.monkey')), {bind:()=>{throw new Error('Fixture Captain requires an admitted product guest');}});
function row(kind: string): SpeciesRow {
  const found = DRIFTWOOD_SPECIES.find(value => value.kind === kind);
  if (found === undefined) throw new Error(`Missing fixture species: ${kind}`);
  return found;
}
export const CRAB = row('crab'), MONKEY = row('monkey'), SAILOR = row('sailor');
