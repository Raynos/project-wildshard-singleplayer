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
import { bloomthroatIguanaNativeClips } from './bloomthroatIguanaNativeClips';
import pickupCatalogue from '@wildshard/game/data/pickupCatalogue' with { type: 'json' };
import authoredGraphs from '../data/lookGraphs.json' with { type: 'json' };
import heldArms from '../data/heldArms.json' with { type: 'json' };
import practiceLighting from '../data/practiceLighting.json' with { type: 'json' };
import neutralGrayLighting from '../data/practiceNeutralGrayLighting.json' with { type: 'json' };
import { BLOOMTHROAT_IGUANA_MOVES, BLOOMTHROAT_IGUANA_DECISIONS, BLOOMTHROAT_IGUANA_ACTORS, BLOOMTHROAT_IGUANA_FIELDS, BLOOMTHROAT_IGUANA_SPECIES, BLOOMTHROAT_IGUANA_STRIKES, BLOOMTHROAT_IGUANA_REWARD } from './bloomthroatIguanaCombat';


type BloomthroatIguanaNativePreviewLighting = 'neutral-studio-v1' | 'neutral-gray-v2';
const lightingProfiles = { 'neutral-studio-v1': practiceLighting['neutral-studio-v1'], ...neutralGrayLighting };



const decisions = BLOOMTHROAT_IGUANA_DECISIONS;
const strikes = BLOOMTHROAT_IGUANA_STRIKES;
const species = BLOOMTHROAT_IGUANA_SPECIES;
const materials = ['driftwood-creature', 'driftwood-creature-glowing',
  'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;

/** One bounded guest, with both live and last-good memory. Compiled bytes are charged separately. */
export const BLOOMTHROAT_IGUANA_NATIVE_PREVIEW_DECISION_MEMORY = decisions.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);

/** Build-only, isolated practice catalogue. No world generator, placement, save or production inventory is imported. */
export function createBloomthroatIguanaNativePreviewSource(arenaLighting?: BloomthroatIguanaNativePreviewLighting): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Bloomthroat Iguana Native WIP Preview', author: 'Wildshard', revision: 2, seed: 0x5ea1 });
  return parseShardfile({ ...base,
    state: { ...base.state, shared: BLOOMTHROAT_IGUANA_FIELDS },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + BLOOMTHROAT_IGUANA_NATIVE_PREVIEW_DECISION_MEMORY },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: BLOOMTHROAT_IGUANA_NATIVE_PREVIEW_DECISION_MEMORY } },
    look: { ...base.look,
      ...(arenaLighting === undefined ? {} : { familyLooks: { ...base.look.familyLooks, toon: lightingProfiles[arenaLighting].toon } }),
      materials: Object.fromEntries(materials.map(id => [id, { family: 'graph', graph: authoredGraphs.looks[id] }])) },
    // This is the existing source runtime identity, not a copied runtime or an instruction to boot the island.
    // The standalone practice host owns the scene and consumes these admitted data sections directly.
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'],
      spawns: { homes: [], bosses: [], actors: BLOOMTHROAT_IGUANA_ACTORS } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: {
        tables: [{ id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
          rows: [{ item: 'coin', weight: 1, count: BLOOMTHROAT_IGUANA_REWARD, match: { kind: 'bloomthroat-iguana' } }] } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] },
        finds: { counters: [], sections: [] }, marks: [],
      } }] },
  });
}

/** Separate product only: never reads or writes the rejected multi-creature generated bake. */
export function createBloomthroatIguanaNativePreviewOutput(creatureBodies: unknown): ProjectOutput {
  const arenaLighting: BloomthroatIguanaNativePreviewLighting = 'neutral-gray-v2';
  const looks = [{ id: 'driftwood.look.bloomthroat-iguana', species: 'creature.bloomthroat-iguana', kind: 'bloomthroat-iguana', pose: 'poses/bloomthroat-iguana.json', rootFlinch: 'authored-pose', rigContract: { skeleton: 'bloomthroat-iguana.native27.v1', clips: [], sockets: ['body','neck','head','jaw'] } }];
  const poses = emitNamedBlobs([
    ['practice/looks.json', { ...practiceLooks, looks, arenaLighting: { profile: arenaLighting, ...lightingProfiles[arenaLighting].hemisphere } }],
    ['practice/bodies.json', creatureBodies],
    ['practice/pickups.json', { ...pickupCatalogue, looks: [], geometries: pickupCatalogue.geometries.filter(row => row.key === pickupCatalogue.coin) }],
    ['poses/bloomthroat-iguana.json', bloomthroatIguanaNativeClips()],
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
      ['actors/moves', BLOOMTHROAT_IGUANA_MOVES],
      ['actors/strikes', strikes], ['sim/scripts', decisions],
      ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } },
        weapons: heldArms.weapons.filter(row => row.blade === 'wood'), cards: [], claims: [] }],
    ])),
  };

}

/** Recompile the one BloomthroatIguana guest against this exact catalogue, then emit and re-read the real SDK product and receipt. */
export async function buildBloomthroatIguanaNativePreviewProduct(project: string, destination: string, options: DecisionBuildOptions, bodies: unknown): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createBloomthroatIguanaNativePreviewSource('neutral-gray-v2');
  const prepared = await prepareProjectOutput(project, createBloomthroatIguanaNativePreviewOutput(bodies), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
