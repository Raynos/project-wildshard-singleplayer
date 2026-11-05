import * as v from 'valibot';
import { nativeBodySchema } from '@wildshard/format/nativePhysics';
import { nalatiNativeBootRows } from '../../src/shards/nalati-grasslands/generators/nativeServer';
import { NALATI_ADMISSION } from './nalati-admission';
import { NALATI_PASTURE } from './nalati-titan';
import { NALATI_RIDING_PROGRAMS } from './nalati-riding';
import { canonicalNativeOracleInput } from './native-oracle';

/** Retain every original authored native identity, stream, recipe and policy.
 * These facts are independent expectations, never derived from the bake. */
const originalBootInputs = () => {
  const rows = nalatiNativeBootRows(NALATI_PASTURE, NALATI_ADMISSION, NALATI_RIDING_PROGRAMS);
  return { ...rows, recipes: v.parse(v.array(nativeBodySchema('axis')), rows.recipes) };
};

/** Typed construction shared by the parent oracle and its fenced child. */
export function nalatiNativeBootInputs(): ReturnType<typeof originalBootInputs> {
  return canonicalNativeOracleInput(originalBootInputs());
}
