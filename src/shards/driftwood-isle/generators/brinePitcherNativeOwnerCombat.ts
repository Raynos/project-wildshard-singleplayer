import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import { BRINE_PITCHER_DECISIONS, BRINE_PITCHER_SPECIES, BRINE_PITCHER_STRIKES } from './brinePitcherCombat';

/** Separate native WIP repertoire: crown, then a bilateral side-head snap.
 * The original three-strike source remains unchanged. Both lateral heads share
 * one visible tell and one damage event, never two overlapping damage receipts.
 */
export const BRINE_PITCHER_NATIVE_OWNER_STRIKES = BRINE_PITCHER_STRIKES.slice(0, 2).map((row, index) => index === 0
  ? Object.assign(structuredClone(row), { shape: { ...row.shape, kind: 'arc' as const } })
  : Object.assign(structuredClone(row), { id: 'strike.pitcher.bilateral', shape: { kind: 'arc' as const, radius: 2.4, halfAngle: 1.17 } }));
export const BRINE_PITCHER_NATIVE_OWNER_DECISIONS = BRINE_PITCHER_DECISIONS.map(row => Object.assign(structuredClone(row), {
  id: 'driftwood.brine-pitcher-native-owner.decision', source: 'behaviour/brine-pitcher-native-owner.as',
  strikes: { crown: 'strike.pitcher.crown', bilateral: 'strike.pitcher.bilateral' },
  state: row.state.map(field => field.name === 'sequence' ? { ...field, max: 1 } : { ...field }),
}));
export const BRINE_PITCHER_NATIVE_OWNER_SPECIES: BrainedSpecies[] = BRINE_PITCHER_SPECIES.map(row => Object.assign(structuredClone(row), {
  brain: { archetype: 'decision', data: { script: 'driftwood.brine-pitcher-native-owner.decision', actor: 'driftwood.brine-pitcher', strikeEffects: [] } },
}));
