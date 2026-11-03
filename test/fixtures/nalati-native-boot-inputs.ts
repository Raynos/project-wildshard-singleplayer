import * as v from 'valibot';
import { nativeBodySchema } from '../../src/format/nativePhysics';
import boot from '../../src/shards/nalati-grasslands/data/headlessBoot.json' with { type: 'json' };
import worldUpdates from '../../src/shards/nalati-grasslands/data/worldUpdates.json' with { type: 'json' };
import combatTargets from '../../src/shards/nalati-grasslands/data/combatTargets.json' with { type: 'json' };
import { NALATI_ECOLOGY as ecology } from '../../src/shards/nalati-grasslands/generators/ecology.mjs';
import { NALATI_ADMISSION } from './nalati-admission';
import { NALATI_PASTURE } from './nalati-titan';
import { NALATI_RIDING_PROGRAMS } from './nalati-riding';
import { canonicalNativeOracleInput } from './native-oracle';

/** Retain every original authored native identity, stream, recipe and policy.
 * These facts are independent expectations, never derived from the bake. */
const originalBootInputs = () => {
  const { compiled: _admissionCompiled, ...admission } = NALATI_ADMISSION;
  const { compiled: _ridingCompiled, ...riding } = NALATI_RIDING_PROGRAMS;
  return { ...boot, recipes: v.parse(v.array(nativeBodySchema('axis')), boot.recipes),
    worldUpdates, combatTargets,
    hunt: { ...ecology.gameplay, ...ecology.species, sheepdog: { aggressive: false, walkSpeed: 1.4 }, [ecology.argymaq]: ecology.gameplay.horse },
    admission, pasture: NALATI_PASTURE, riding };
};

/** Typed construction shared by the parent oracle and its fenced child. */
export function nalatiNativeBootInputs(): ReturnType<typeof originalBootInputs> {
  return canonicalNativeOracleInput(originalBootInputs());
}
