import { emptyShardfile } from '@wildshard/sdk/author';
import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import type { DecisionBuildOptions } from '@wildshard/sdk/buildDecisionScripts';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { validateOutputProduct, writeOutputProduct } from '@wildshard/sdk/outputProduct';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { mergeProjectBlobs, prepareProjectOutput, type ProjectOutput } from '@wildshard/sdk/projectOutput';
import { parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { readSpeciesProgram } from '@wildshard/format/speciesPrograms';
import practiceLooks from '../data/practiceLooks.json' with { type: 'json' };
import { mantisFoldedClips } from './mantisFoldedClips';
import pickupCatalogue from '@wildshard/game/data/pickupCatalogue' with { type: 'json' };
import authoredGraphs from '../data/lookGraphs.json' with { type: 'json' };
import heldArms from '../data/heldArms.json' with { type: 'json' };
import practiceLighting from '../data/practiceLighting.json' with { type: 'json' };
import neutralGrayLighting from '../data/practiceNeutralGrayLighting.json' with { type: 'json' };
import { DRIFTWOOD_REGULAR_ACTORS, DRIFTWOOD_REGULAR_FIELDS,
  DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_REWARDS, DRIFTWOOD_REGULAR_SPECIES, DRIFTWOOD_REGULAR_STRIKES } from './driftwoodRegularCombat';


import { MANTIS_PHASE_DECISIONS, MANTIS_PHASE_FIELDS } from './mantisPhaseDecision';

type MantisFoldedPreviewLighting = 'neutral-studio-v1' | 'neutral-gray-v2';
const lightingProfiles = { 'neutral-studio-v1': practiceLighting['neutral-studio-v1'], ...neutralGrayLighting };



const decisions = MANTIS_PHASE_DECISIONS;
const strikes = DRIFTWOOD_REGULAR_STRIKES.filter(row => row.id.startsWith('strike.splinter-mantis.'));
const species: typeof DRIFTWOOD_REGULAR_SPECIES = [];
for (const row of DRIFTWOOD_REGULAR_SPECIES) {
  if (row.kind === 'splinter-mantis') species.push({ ...row, label: 'Splinter Mantis Folded Native · UNACCEPTED WIP' });
}
const materials = ['driftwood-creature', 'driftwood-creature-glowing',
  'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;

/** One bounded guest, with both live and last-good memory. Compiled bytes are charged separately. */
export const MANTIS_FOLDED_PREVIEW_DECISION_MEMORY = decisions.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);

/** Build-only, isolated practice catalogue. No world generator, placement, save or production inventory is imported. */
export function createMantisFoldedPreviewSource(arenaLighting?: MantisFoldedPreviewLighting): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Mantis Folded Native WIP Preview', author: 'Wildshard', revision: 2, seed: 0x5ea1 });
  return parseShardfile({ ...base,
    state: { ...base.state, shared: [...DRIFTWOOD_REGULAR_FIELDS.filter(row => ['mantis-st', 'mantis-beat', 'regular-clock'].includes(row.name)), ...MANTIS_PHASE_FIELDS] },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + MANTIS_FOLDED_PREVIEW_DECISION_MEMORY },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: MANTIS_FOLDED_PREVIEW_DECISION_MEMORY } },
    look: { ...base.look,
      ...(arenaLighting === undefined ? {} : { familyLooks: { ...base.look.familyLooks, toon: lightingProfiles[arenaLighting].toon } }),
      materials: Object.fromEntries(materials.map(id => [id, { family: 'graph', graph: authoredGraphs.looks[id] }])) },
    // This is the existing source runtime identity, not a copied runtime or an instruction to boot the island.
    // The standalone practice host owns the scene and consumes these admitted data sections directly.
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'],
      spawns: { homes: [], bosses: [], actors: DRIFTWOOD_REGULAR_ACTORS.filter(row => row.kind === 'splinter-mantis') } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: {
        tables: [{ id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
          rows: Object.entries(DRIFTWOOD_REGULAR_REWARDS).filter(([kind]) => kind === 'splinter-mantis')
            .map(([kind, count]) => ({ item: 'coin', weight: 1, count, match: { kind } })) } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] },
        finds: { counters: [], sections: [] }, marks: [],
      } }] },
  });
}

/** Separate product only: never reads or writes the rejected multi-creature generated bake. */
export function createMantisFoldedPreviewOutput(creatureBodies: unknown): ProjectOutput {
  const arenaLighting: MantisFoldedPreviewLighting = 'neutral-gray-v2';
  const looks: ((typeof practiceLooks.looks)[number] & { rootFlinch: 'authored-pose' })[] = [];
  for (const row of practiceLooks.looks) {
    if (row.kind === 'splinter-mantis') looks.push({ ...row, rootFlinch: 'authored-pose',
      rigContract: { ...row.rigContract, skeleton: 'splinter-mantis.v7-native22' } });
  }
  const poses = emitNamedBlobs([
    ['practice/looks.json', { ...practiceLooks, looks, arenaLighting: { profile: arenaLighting, ...lightingProfiles[arenaLighting].hemisphere } }],
    ['practice/bodies.json', creatureBodies],
    ['practice/pickups.json', { ...pickupCatalogue, looks: [], geometries: pickupCatalogue.geometries.filter(row => row.key === pickupCatalogue.coin) }],
    ['poses/splinter-mantis.json', mantisFoldedClips()],
  ].map(([name, value]) => {
    if (typeof name !== 'string') throw new Error('Preview requires a logical filename');
    return nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(value)));
  }));
  const { arms, wood, iron, swim } = heldArms.look.materials;

  /** Source-only placeholders are replaced by prepareProjectOutput before any product can pass admission. */
  return {
    namedFiles: poses.files, assets: poses.assets,
    platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
      ['actors/species-programs', { page: [], native: [], program: readSpeciesProgram({
        species: species.map(row => Object.assign(bakeSpecies(row, row.id), { brain: row.brain, body: row.body })), strikes,
      }) }],
      ['actors/moves', DRIFTWOOD_REGULAR_MOVES.filter(row => row.id === 'splinter-mantis.stalk')],
      ['actors/strikes', strikes], ['sim/scripts', decisions],
      ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } },
        weapons: heldArms.weapons.filter(row => row.blade === 'wood'), cards: [], claims: [] }],
    ])),
  };

}

/** Recompile the one Mantis guest against this exact catalogue, then emit and re-read the real SDK product and receipt. */
export async function buildMantisFoldedPreviewProduct(project: string, destination: string, options: DecisionBuildOptions, bodies: unknown): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createMantisFoldedPreviewSource('neutral-gray-v2');
  const prepared = await prepareProjectOutput(project, createMantisFoldedPreviewOutput(bodies), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
