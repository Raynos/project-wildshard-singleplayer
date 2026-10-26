
import { CAPTAIN_BRAIN, CAPTAIN_BODY } from './captainDecision';
import { DRIFTWOOD_SPAWNS } from './spawnTables';
import { DRIFTWOOD_NATIVE_HUNT } from './nativeHunt';
import { readSpeciesProgram , type SpeciesProgramData as SpeciesProgramDataType, type SpeciesData as SpeciesDataType } from '@wildshard/format/speciesPrograms';
import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import { DRIFTWOOD_ENEMY_SPECIES, DRIFTWOOD_ENEMY_STRIKES, ENEMY_SPECIES_METADATA } from './enemySpecies';
import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { ISLAND_BOAR, ISLAND_BEAR } from './faunaSpecies';

const rows = [ISLAND_BOAR, ISLAND_BEAR].map(row => bakeSpecies(row, row.id));
/** Both owners read the identical gameplay rows; the separate fauna look retains its rig and coat. */
const authored: readonly BrainedSpecies[] = [...DRIFTWOOD_ENEMY_SPECIES, { ...ENEMY_SPECIES_METADATA.captain, brain:CAPTAIN_BRAIN, body:CAPTAIN_BODY }];
export const DRIFTWOOD_ENEMY_PROGRAM: SpeciesProgramDataType = readSpeciesProgram({ species: authored.map(row => Object.assign(bakeSpecies(row, row.id),
  row.brain === undefined ? {} : { brain: row.brain }, row.body === undefined ? {} : { body: row.body })), strikes: DRIFTWOOD_ENEMY_STRIKES });
export const DRIFTWOOD_SPECIES_PROGRAMS: { spawns: { id: string; table: { mode: "each" | "weighted"; rows: ({ item: { kind: string; variant?: string; }; weight: number; count?: (number) | ([number, number]); when?: { kind?: string; tags?: (string)[]; }; })[]; }; respawn?: { delay: number; away: number; }; }[]; hunt: { readonly limit: 256; readonly fight: { readonly telegraphed: true; readonly attackers: 2; }; readonly tuning: { boar: { sightRange: number; sightRangeGraze: number; sightCone: number; hearWalk: number; hearSprint: number; noticeRate: number; impactAlert: number; }; }; readonly player: "host"; readonly bands: { readonly states: readonly ["sidestep"]; readonly legacyKinds: readonly ["captain"]; }; readonly hit: { readonly namespace: "creature"; readonly tags: readonly ["feel.blow", "cover.checked"]; }; readonly memoryFields: readonly ["timer", "tx", "tz", "fleeT", "fleeUntil", "chargeCd", "callT", "awareness", "freeze", "spooked", "wary", "sensed", "windup", "backoff", "side", "committed", "path", "pathI", "goalX", "goalZ", "repathAt"]; }; page: SpeciesDataType[]; native: SpeciesDataType[]; program: SpeciesProgramDataType; } = { spawns: DRIFTWOOD_SPAWNS, hunt: DRIFTWOOD_NATIVE_HUNT, page: rows, native: rows, program: DRIFTWOOD_ENEMY_PROGRAM };
