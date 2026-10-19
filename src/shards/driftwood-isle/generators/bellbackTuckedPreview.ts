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
import { bellbackTuckedClips } from './bellbackTuckedClips';
import pickupCatalogue from '@wildshard/game/data/pickupCatalogue' with { type: 'json' };
import authoredGraphs from '../data/lookGraphs.json' with { type: 'json' };
import heldArms from '../data/heldArms.json' with { type: 'json' };
import practiceLighting from '../data/practiceLighting.json' with { type: 'json' };
import neutralGrayLighting from '../data/practiceNeutralGrayLighting.json' with { type: 'json' };
import { TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_ACTORS, TIDAL_GIANTS_FIELDS,
  TIDAL_GIANTS_MOVES, TIDAL_GIANTS_BOUNTIES, TIDAL_GIANTS_SPECIES, TIDAL_GIANTS_STRIKES } from './tidalGiantsCombat';


type BellbackTuckedPreviewLighting = 'neutral-studio-v1' | 'neutral-gray-v2';
const lightingProfiles = { 'neutral-studio-v1': practiceLighting['neutral-studio-v1'], ...neutralGrayLighting };



const decisions = TIDAL_GIANTS_DECISIONS.filter(row => row.id === 'driftwood.bellback.decision');
const strikes = TIDAL_GIANTS_STRIKES.filter(row => row.id.startsWith('strike.bellback.'));
const species: typeof TIDAL_GIANTS_SPECIES = [];
for (const row of TIDAL_GIANTS_SPECIES) {
  if (row.kind === 'bellback') species.push({ ...row, label: 'Bellback Frame2 Tucked · UNACCEPTED WIP' });
}
const materials = ['driftwood-creature', 'driftwood-creature-glowing',
  'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;

/** One bounded guest, with both live and last-good memory. Compiled bytes are charged separately. */
export const BELLBACK_TUCKED_PREVIEW_DECISION_MEMORY = decisions.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);

/** Build-only, isolated practice catalogue. No world generator, placement, save or production inventory is imported. */
export function createBellbackTuckedPreviewSource(arenaLighting?: BellbackTuckedPreviewLighting): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Bellback Frame2 Tucked WIP Preview', author: 'Wildshard', revision: 2, seed: 0x5ea1 });
  return parseShardfile({ ...base,
    state: { ...base.state, shared: TIDAL_GIANTS_FIELDS },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + BELLBACK_TUCKED_PREVIEW_DECISION_MEMORY },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: BELLBACK_TUCKED_PREVIEW_DECISION_MEMORY } },
    look: { ...base.look,
      ...(arenaLighting === undefined ? {} : { familyLooks: { ...base.look.familyLooks, toon: lightingProfiles[arenaLighting].toon } }),
      materials: Object.fromEntries(materials.map(id => [id, { family: 'graph', graph: authoredGraphs.looks[id] }])) },
    // This is the existing source runtime identity, not a copied runtime or an instruction to boot the island.
    // The standalone practice host owns the scene and consumes these admitted data sections directly.
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'],
      spawns: { homes: [], bosses: [], actors: TIDAL_GIANTS_ACTORS.filter(row => row.kind === 'bellback') } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: {
        tables: [{ id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
          rows: Object.entries(TIDAL_GIANTS_BOUNTIES).filter(([kind]) => kind === 'bellback')
            .map(([kind, count]) => ({ item: 'coin', weight: 1, count, match: { kind } })) } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] },
        finds: { counters: [], sections: [] }, marks: [],
      } }] },
  });
}

/** Separate product only: never reads or writes the rejected multi-creature generated bake. */
export function createBellbackTuckedPreviewOutput(creatureBodies: unknown): ProjectOutput {
  const arenaLighting: BellbackTuckedPreviewLighting = 'neutral-gray-v2';
  const looks: ((typeof practiceLooks.looks)[number] & { rootFlinch: 'authored-pose' })[] = [];
  for (const row of practiceLooks.looks) {
    if (row.kind === 'bellback') looks.push({ ...row, rootFlinch: 'authored-pose',
      rigContract: { ...row.rigContract, skeleton: 'bellback.v6-frame2-native8' } });
  }
  const poses = emitNamedBlobs([
    ['practice/looks.json', { ...practiceLooks, looks, arenaLighting: { profile: arenaLighting, ...lightingProfiles[arenaLighting].hemisphere } }],
    ['practice/bodies.json', creatureBodies],
    ['practice/pickups.json', { ...pickupCatalogue, looks: [], geometries: pickupCatalogue.geometries.filter(row => row.key === pickupCatalogue.coin) }],
    ['poses/bellback.json', bellbackTuckedClips()],
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
      ['actors/moves', TIDAL_GIANTS_MOVES.filter(row => row.id === 'bellback.approach')],
      ['actors/strikes', strikes], ['sim/scripts', decisions],
      ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } },
        weapons: heldArms.weapons.filter(row => row.blade === 'wood'), cards: [], claims: [] }],
    ])),
  };

}

/** Recompile the one Bellback guest against this exact catalogue, then emit and re-read the real SDK product and receipt. */
export async function buildBellbackTuckedPreviewProduct(project: string, destination: string, options: DecisionBuildOptions, bodies: unknown): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createBellbackTuckedPreviewSource('neutral-gray-v2');
  const prepared = await prepareProjectOutput(project, createBellbackTuckedPreviewOutput(bodies), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
