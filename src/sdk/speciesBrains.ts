import { admitSpeciesBrains, type BrainedSpecies as PlatformBrainedSpecies, type SpeciesBrain as PlatformSpeciesBrain,
  type SpeciesBrains as PlatformSpeciesBrains } from '@wildshard/game/shardfile/speciesBrains';
import { strike, type StrikeData } from './species';

/** A species row's declared brain (SHARD-PLATFORM SF27): `{ archetype, data }`, one platform archetype and its data. */
export type SpeciesBrain = PlatformSpeciesBrain;
/** Species gameplay data with an optional `brain`; a row without one keeps its runtime's own policy. */
export type BrainedSpecies = PlatformBrainedSpecies;
/** A catalogue's admitted brains: browser rows (`row`), the live witness and the headless home policies. */
export type SpeciesBrains = PlatformSpeciesBrains;
/**
 * Admit a shard's species catalogue and its strike rows (SF27): each strike passes the SDK's strict strike schema, each
 * declared brain its archetype's schema, and every strike a brain names resolves, before any row or policy is built.
 */
export function speciesBrains(species: readonly BrainedSpecies[], strikes: readonly StrikeData[]): SpeciesBrains {
  return admitSpeciesBrains(species, strikes.map(row => strike(row)));
}
