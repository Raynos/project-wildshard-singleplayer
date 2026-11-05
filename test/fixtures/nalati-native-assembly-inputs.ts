import { PageTamingBindingSchema } from '@wildshard/format/riding';
import * as v from 'valibot';
import { nalatiNativeAssemblyRows } from '../../src/shards/nalati-grasslands/generators/nativeServer';
import { nalatiNativeGroupWire } from '../../src/shards/nalati-grasslands/generators/nativeGroupWire';
import { nalatiNativeShelters } from '../../src/shards/nalati-grasslands/generators/shelters';
import { NALATI_PASTURE } from './nalati-titan';
import { NALATI_ADMISSION } from './nalati-admission';
// oxlint-disable-next-line import/no-nodejs-modules -- The parent retains independent original collider expectations.
import { readFileSync } from 'node:fs';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import { canonicalNativeOracleInput } from './native-oracle';

/** Original independent native facts, including policy and expectation rows.
 * No expected entry count or native policy is inferred from checked geometry. */
function originalPlaces(): unknown {
  const bytes = readFileSync('test/fixtures/nalati-places-original.json');
  if (bytes.byteLength !== 1506858 || hashImmutableBytes(bytes) !== 'fbe66ce2b4050879276a2878bb8de2ede6171625b8b1bf1b13431e8031d75384')
    throw new Error('Original native place metadata differs');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function nalatiNativeAssemblyInputs(placed: unknown = originalPlaces()) {
  const places = v.parse(v.object({ rows: v.array(v.object({ colliders: v.array(v.object({
    hw: v.number(), hd: v.number(), yTop: v.number(), yBottom: v.number(), x: v.number(), z: v.number(),
  })) })) }), placed);
  const assembly = nalatiNativeAssemblyRows(NALATI_PASTURE, NALATI_ADMISSION, nalatiNativeShelters(places));
  const { pageWildlife, pageGroups: _pageGroups, groupAdmission: _groupAdmission, nativeField: _nativeField,
    nativeDayClock: _nativeDayClock, nativeKnockdown: _nativeKnockdown, ...constants } = assembly.constants;
  const riding = constants.nativePopulation;
  return canonicalNativeOracleInput({ ...assembly, constants: { ...constants,
    groupRows: nalatiNativeGroupWire(constants.groupRows, pageWildlife.pasture),
    nativeTaming: { ...constants.nativeTaming, binding: v.parse(PageTamingBindingSchema, constants.nativeTaming.binding) },
    nativePopulation: { ...riding, shepherdOffset: v.parse(v.tuple([v.number(), v.number()]), riding.shepherdOffset),
      variants: riding.variants.map(row => ({ ...row, rows: row.rows.map(variant => ({ ...variant, scale: v.parse(v.tuple([v.number(), v.number()]), variant.scale) })) })) },
  } });
}
