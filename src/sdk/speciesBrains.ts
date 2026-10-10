import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { PackHowlerBrain, HowlerPorts } from '@wildshard/engine/ai/packHowler';
import type { LedgePouncerBrain, PouncerPorts, PouncerContext, PouncerLedge } from '@wildshard/engine/ai/ledgePouncer';
import { admitSpeciesBrains, type BrainedSpecies as PlatformBrainedSpecies, type SpeciesBrain as PlatformSpeciesBrain,
  type SpeciesBrains as PlatformSpeciesBrains } from '@wildshard/game/shardfile/speciesBrains';
import { moduleBytes } from '@wildshard/game/shardfile/speciesScripts';
import { strike, type StrikeData } from './species';

/** A species row's declared brain (SHARD-PLATFORM SF27): `{ archetype, data }`, one platform archetype and its data. */
export type SpeciesBrain = PlatformSpeciesBrain;
/** Species gameplay data with an optional `brain`; a row without one keeps its runtime's own policy. */
export type BrainedSpecies = PlatformBrainedSpecies;
/** A catalogue's admitted brains: browser callbacks (`bind`), the live witness and the headless home policies. */
export type SpeciesBrains = PlatformSpeciesBrains;
/**
 * Admit a shard's species catalogue and its strike rows (SF27): each strike passes the SDK's strict strike schema, each
 * declared brain its archetype's schema, and every strike a brain names resolves, before any row or policy is built; a
 * `script` brain's module comes in `modules` (a plain row: its SHA-256 → the base64 its bake wrote) and is admitted on its own
 * ScriptHost.
 */
export function speciesBrains(species: readonly BrainedSpecies[], strikes: readonly StrikeData[], modules: Readonly<Record<string, string>> = {}): SpeciesBrains {
  return admitSpeciesBrains(species, strikes.map(row => strike(row)), new Map(Object.entries(modules).map(([hash, base64]) => [hash, moduleBytes(base64)] as const)));
}

/** A retained declared pouncer's decisions, frame law and exact continuation, with a trusted native body. */
export type SpeciesPouncer<A extends AnimalSim> = LedgePouncerBrain<A>;
/** Native ledge, height/head/contact and presentation authority for a declared pouncer. */
export type SpeciesPouncerPorts<A> = PouncerPorts<A>;
/** The manager decision clock and native path authority, independent of the fixed frame clock. */
export type SpeciesPouncerContext<A> = PouncerContext<A>;
/** One native solid ledge in a pouncer's bounded observation set. */
export type SpeciesPouncerLedge = PouncerLedge;

/** Declared pack-leader decisions, frame law and exact continuation bound to an actual native body. */
export type SpeciesHowler<A extends AnimalSim> = PackHowlerBrain<A>;
/** Real pack, shared AI stream, environment and entered presentation authority for a declared howler. */
export type SpeciesHowlerPorts<A extends AnimalSim> = HowlerPorts<A>;
