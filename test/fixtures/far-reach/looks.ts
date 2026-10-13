import { SKY_CREATURE_LOOKS } from '../../../src/shards/far-reach/species/bodies';

function look(kind: string) {
  const found = SKY_CREATURE_LOOKS.find(row => row.kind === kind);
  if (found === undefined) throw new Error(`Missing shipping look ${kind}`);
  return found;
}
export const SKY_GOAT_LOOK = look('skyGoat');
export const DRIFT_RAY_LOOK = look('driftRay');
export const GALE_WISP_LOOK = look('galeWisp');
export const STORM_ROC_LOOK = look('stormRoc');
