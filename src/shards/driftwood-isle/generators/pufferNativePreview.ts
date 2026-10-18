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
import { pufferNativeClips, type PufferPreviewPose } from './pufferNativeClips';
import { pufferNativeGait4Clips } from './pufferNativeGait4Clips';
import pickupCatalogue from '@wildshard/game/data/pickupCatalogue' with { type: 'json' };
import authoredGraphs from '../data/lookGraphs.json' with { type: 'json' };
import heldArms from '../data/heldArms.json' with { type: 'json' };
import { DRIFTWOOD_REGULAR_ACTORS, DRIFTWOOD_REGULAR_DECISIONS, DRIFTWOOD_REGULAR_FIELDS,
  DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_REWARDS, DRIFTWOOD_REGULAR_SPECIES, DRIFTWOOD_REGULAR_STRIKES } from './driftwoodRegularCombat';


export type PufferNativePreviewMode = PufferPreviewPose | 'gait4';

const decisions = DRIFTWOOD_REGULAR_DECISIONS.filter(row => row.id === 'driftwood.brine-puffer.decision');
const strikes = DRIFTWOOD_REGULAR_STRIKES.filter(row => row.id === 'strike.brine-puffer.burst');
const species: typeof DRIFTWOOD_REGULAR_SPECIES = [];
for (const row of DRIFTWOOD_REGULAR_SPECIES) {
  if (row.kind === 'brine-puffer') species.push({ ...row, label: 'Brine Puffer Native · UNACCEPTED WIP' });
}
const materials = ['driftwood-creature', 'driftwood-creature-glowing',
  'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;

/** One bounded guest, with both live and last-good memory. Compiled bytes are charged separately. */
export const PUFFER_PREVIEW_DECISION_MEMORY = decisions.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);

/** Build-only, isolated practice catalogue. No world generator, placement, save or production inventory is imported. */
export function createPufferPreviewSource(): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Puffer Native WIP Preview', author: 'Wildshard', revision: 2, seed: 0x5ea1 });
  return parseShardfile({ ...base,
    state: { ...base.state, shared: DRIFTWOOD_REGULAR_FIELDS.filter(row => ['puffer-st', 'regular-clock'].includes(row.name)) },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + PUFFER_PREVIEW_DECISION_MEMORY },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: PUFFER_PREVIEW_DECISION_MEMORY } },
    look: { ...base.look, materials: Object.fromEntries(materials.map(id => [id, { family: 'graph', graph: authoredGraphs.looks[id] }])) },
    // This is the existing source runtime identity, not a copied runtime or an instruction to boot the island.
    // The standalone practice host owns the scene and consumes these admitted data sections directly.
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'],
      spawns: { homes: [], bosses: [], actors: DRIFTWOOD_REGULAR_ACTORS.filter(row => row.kind === 'brine-puffer') } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: {
        tables: [{ id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
          rows: Object.entries(DRIFTWOOD_REGULAR_REWARDS).filter(([kind]) => kind === 'brine-puffer')
            .map(([kind, count]) => ({ item: 'coin', weight: 1, count, match: { kind } })) } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] },
        finds: { counters: [], sections: [] }, marks: [],
      } }] },
  });
}

/** Separate product only: never reads or writes the rejected multi-creature generated bake. */
export function createPufferPreviewOutput(creatureBodies: unknown, mode: PufferNativePreviewMode): ProjectOutput {
  const poses = emitNamedBlobs([
    ['practice/looks.json', { ...practiceLooks, looks: practiceLooks.looks.filter(row => row.kind === 'brine-puffer') }],
    ['practice/bodies.json', creatureBodies],
    ['practice/pickups.json', { ...pickupCatalogue, looks: [], geometries: pickupCatalogue.geometries.filter(row => row.key === pickupCatalogue.coin) }],
    ['poses/brine-puffer.json', mode === 'gait4' ? pufferNativeGait4Clips() : pufferNativeClips(mode)],
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
      ['actors/moves', DRIFTWOOD_REGULAR_MOVES.filter(row => row.id === 'brine-puffer.stalk')],
      ['actors/strikes', strikes], ['sim/scripts', decisions],
      ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } },
        weapons: heldArms.weapons.filter(row => row.blade === 'wood'), cards: [], claims: [] }],
    ])),
  };

}

/** Recompile the one Puffer guest against this exact catalogue, then emit and re-read the real SDK product and receipt. */
export async function buildPufferPreviewProduct(project: string, destination: string, options: DecisionBuildOptions, bodies: unknown, mode: PufferNativePreviewMode): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createPufferPreviewSource();
  const prepared = await prepareProjectOutput(project, createPufferPreviewOutput(bodies, mode), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
