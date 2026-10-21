import { emptyShardfile } from '@wildshard/sdk/author';
import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import type { DecisionBuildOptions } from '@wildshard/sdk/buildDecisionScripts';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { validateOutputProduct, writeOutputProduct } from '@wildshard/sdk/outputProduct';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { mergeProjectBlobs, prepareProjectOutput, type ProjectOutput } from '@wildshard/sdk/projectOutput';
import { parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { readSpeciesProgram } from '@wildshard/format/speciesPrograms';
import practiceLooks from '../data/practiceLooks.json' with { type: 'json' };
import pickupCatalogue from '@wildshard/game/data/pickupCatalogue' with { type: 'json' };
import authoredGraphs from '../data/lookGraphs.json' with { type: 'json' };
import heldArms from '../data/heldArms.json' with { type: 'json' };
import practiceLighting from '../data/practiceLighting.json' with { type: 'json' };
import neutralGrayLighting from '../data/practiceNeutralGrayLighting.json' with { type: 'json' };
import { DRIFTWOOD_REGULAR_ACTORS, DRIFTWOOD_REGULAR_DECISIONS, DRIFTWOOD_REGULAR_FIELDS,
  DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_REWARDS, DRIFTWOOD_REGULAR_SPECIES, DRIFTWOOD_REGULAR_STRIKES } from './driftwoodRegularCombat';

type ActualConchProofLighting = 'neutral-studio-v1' | 'neutral-gray-v2';
const lightingProfiles = { 'neutral-studio-v1': practiceLighting['neutral-studio-v1'], ...neutralGrayLighting };


const decisions = DRIFTWOOD_REGULAR_DECISIONS.filter(row => row.id === 'driftwood.conch-duelist.decision');
const strikes = DRIFTWOOD_REGULAR_STRIKES.filter(row => row.id.startsWith('strike.conch-duelist.'));
const species: typeof DRIFTWOOD_REGULAR_SPECIES = [];
for (const row of DRIFTWOOD_REGULAR_SPECIES) {
  if (row.kind === 'conch-duelist') species.push({ ...row, label: 'UNADMITTED ACTUAL CONCH DIAGNOSTIC' });
}
const materials = ['driftwood-creature', 'driftwood-creature-glowing',
  'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;

/** Actual-source diagnostic using the unchanged bounded guest, with live and last-good memory. Compiled bytes are charged separately. */
export const ACTUAL_CONCH_PROOF_DECISION_MEMORY = decisions.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);

/** Build-only, isolated practice catalogue. No world generator, placement, save or production inventory is imported. */
export function createActualConchProofSource(arenaLighting?: ActualConchProofLighting): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Private unadmitted actual Conch diagnostic', author: 'Wildshard', revision: 1, seed: 0x5ea1 });
  return parseShardfile({ ...base,
    state: { ...base.state, shared: DRIFTWOOD_REGULAR_FIELDS.filter(row => ['conch-st', 'conch-guard', 'regular-clock'].includes(row.name)) },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + ACTUAL_CONCH_PROOF_DECISION_MEMORY },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: ACTUAL_CONCH_PROOF_DECISION_MEMORY } },
    look: { ...base.look,
      ...(arenaLighting === undefined ? {} : { familyLooks: { ...base.look.familyLooks, toon: lightingProfiles[arenaLighting].toon } }),
      materials: Object.fromEntries(materials.map(id => [id, { family: 'graph', graph: authoredGraphs.looks[id] }])) },
    // This is the existing source runtime identity, not a copied runtime or an instruction to boot the island.
    // The standalone practice host owns the scene and consumes these validated data sections directly.
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'],
      spawns: { homes: [], bosses: [], actors: DRIFTWOOD_REGULAR_ACTORS.filter(row => row.kind === 'conch-duelist') } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: {
        tables: [{ id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
          rows: Object.entries(DRIFTWOOD_REGULAR_REWARDS).filter(([kind]) => kind === 'conch-duelist')
            .map(([kind, count]) => ({ item: 'coin', weight: 1, count, match: { kind } })) } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] },
        finds: { counters: [], sections: [] }, marks: [],
      } }] },
  });
}

/** Separate product only: never reads or writes the rejected multi-creature generated bake. */
export function createActualConchProofOutput(metadataBytes: Uint8Array, motionBytes: Uint8Array): ProjectOutput {
  if (hashImmutableBytes(metadataBytes) !== '6905f20ced953176fb0e316a8d18287735eef0fb996cd58af43ae918b8f87989'
    || hashImmutableBytes(motionBytes) !== '494d35c49765df3623a6943b9834ecc7d244ae6ba0ba3b53a9ffe6f4e09d9596')
    throw new Error('Private diagnostic requires exact actual Conch metadata and motion bytes');
  const arenaLighting: ActualConchProofLighting = 'neutral-gray-v2';
  const looks: ((typeof practiceLooks.looks)[number] & { rootFlinch: 'authored-pose' })[] = [];
  for (const row of practiceLooks.looks) {
    if (row.kind === 'conch-duelist') looks.push({ ...row, pose: 'poses/conch-articulated-complete1.json', rootFlinch: 'authored-pose',
      rigContract: { ...row.rigContract, skeleton: 'conch-duelist.character-native15' } });
  }
  const poses = emitNamedBlobs([...[
    ['practice/looks.json', { ...practiceLooks, looks, arenaLighting: { profile: arenaLighting, ...lightingProfiles[arenaLighting].hemisphere } }],
    ['practice/pickups.json', { ...pickupCatalogue, looks: [], geometries: pickupCatalogue.geometries.filter(row => row.key === pickupCatalogue.coin) }],
  ].map(([name, value]) => {
    if (typeof name !== 'string') throw new Error('Preview requires a logical filename');
    return nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(value)));
  }), nameBlob('practice/bodies.json', 'json', metadataBytes),
  nameBlob('poses/conch-articulated-complete1.json', 'json', motionBytes)]);
  const { arms, wood, iron, swim } = heldArms.look.materials;

  /** Source-only placeholders are replaced by prepareProjectOutput before product validation (not model admission). */
  return {
    namedFiles: poses.files, assets: poses.assets,
    platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
      ['actors/species-programs', { page: [], native: [], program: readSpeciesProgram({
        species: species.map(row => Object.assign(bakeSpecies(row, row.id), { brain: row.brain, body: row.body })), strikes,
      }) }],
      ['actors/moves', DRIFTWOOD_REGULAR_MOVES.filter(row => row.id === 'conch-duelist.stalk')],
      ['actors/strikes', strikes], ['sim/scripts', decisions],
      ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } },
        weapons: heldArms.weapons.filter(row => row.blade === 'wood'), cards: [], claims: [] }],
    ])),
  };

}

/** Recompile the one Conch guest against this exact catalogue, then emit and re-read the real SDK product and receipt. */
export async function buildActualConchProofProduct(project: string, destination: string, options: DecisionBuildOptions, metadataBytes: Uint8Array, motionBytes: Uint8Array): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createActualConchProofSource('neutral-gray-v2');
  const prepared = await prepareProjectOutput(project, createActualConchProofOutput(metadataBytes, motionBytes), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
