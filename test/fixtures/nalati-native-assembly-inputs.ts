import { PageTamingBindingSchema } from '../../src/format/riding';
import * as v from 'valibot';
import { nalatiHeadlessAssembly } from '../../src/shards/nalati-grasslands/generators/nativeGroups';
import { nalatiNativeGroupWire } from '../../src/shards/nalati-grasslands/generators/nativeGroupWire';
import { buildEliteEntryPageRows } from '../../src/shards/nalati-grasslands/generators/eliteEntryRows';
import { nalatiRidingPopulation } from '../../src/shards/nalati-grasslands/generators/ridingRows.mjs';
import { NALATI_ECOLOGY as ecology } from '../../src/shards/nalati-grasslands/generators/ecology.mjs';
import { nalatiNativeShelters } from '../../src/shards/nalati-grasslands/generators/shelters';
import nativeRide from '../../src/shards/nalati-grasslands/data/nativeRiding.json' with { type: 'json' };
import boot from '../../src/shards/nalati-grasslands/data/headlessBoot.json' with { type: 'json' };
import crowdNativeProjection from '../../src/shards/nalati-grasslands/data/crowdNativeProjection.json' with { type: 'json' };
import { NALATI_PASTURE } from './nalati-titan';
import { NALATI_ADMISSION } from './nalati-admission';
import { nativePlaceFile } from './nalati-native-place-files';
import { canonicalNativeOracleInput } from './native-oracle';

/** Original independent native facts, including policy and expectation rows.
 * No expected entry count or native policy is inferred from checked geometry. */
export function nalatiNativeAssemblyInputs() {
  const assembly = nalatiHeadlessAssembly(NALATI_PASTURE, NALATI_ADMISSION);
  const { pageWildlife, pageGroups: _pageGroups, groupAdmission: _groupAdmission, nativeField: _nativeField,
    nativeDayClock: _nativeDayClock, nativeKnockdown: _nativeKnockdown, ...constants } = assembly.constants;
  const riding = nalatiRidingPopulation(ecology);
  const places = v.parse(v.object({ rows: v.array(v.object({ colliders: v.array(v.object({
    hw: v.number(), hd: v.number(), yTop: v.number(), yBottom: v.number(), x: v.number(), z: v.number(),
  })) })) }), JSON.parse(new TextDecoder().decode(nativePlaceFile('places.json'))));
  return canonicalNativeOracleInput({ ...assembly, constants: { ...constants,
    groupRows: nalatiNativeGroupWire(constants.groupRows, pageWildlife.pasture),
    pageElites: { ...buildEliteEntryPageRows(), profiles: ecology.keeperElites.map(value => ({ id: value.def.id, value })) },
    eliteDefs: Object.fromEntries(Object.entries(ecology.elites).filter(([id]) => ['aqbars', 'kokbori', 'argymaq'].includes(id)).map(([id, def]) => [id, {
      id: def.id, lair: def.lair, awareR: def.awareR, engageR: def.engageR, leashR: def.leashR, rule: def.rule, respawnMin: def.respawnMin,
    }])), nativeTaming: { ...constants.nativeTaming, binding: v.parse(PageTamingBindingSchema, constants.nativeTaming.binding) },
    nativePopulation: { ...riding, shepherdOffset: v.parse(v.tuple([v.number(), v.number()]), riding.shepherdOffset),
      variants: riding.variants.map(row => ({ ...row, rows: row.rows.map(variant => ({ ...variant, scale: v.parse(v.tuple([v.number(), v.number()]), variant.scale) })) })), driver: { ...riding.driver, projection: crowdNativeProjection } },
    nativeRide: { ...nativeRide, speeds: ecology.modes.ride[0].gaits, roads: boot.roads }, nativeShelters: nalatiNativeShelters(places),
  } });
}
