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
import creatureBodies from '../data/creatureBodies.generated.json' with { type: 'json' };
import authoredGraphs from '../data/lookGraphs.json' with { type: 'json' };
import heldArms from '../data/heldArms.json' with { type: 'json' };
import brinePufferClips from '../data/brinePufferClips.generated.json' with { type: 'json' };
import conchDuelistClips from '../data/conchDuelistClips.generated.json' with { type: 'json' };
import splinterMantisClips from '../data/splinterMantisClips.generated.json' with { type: 'json' };
import bellbackClips from '../data/bellbackClips.generated.json' with { type: 'json' };
import tideRootColossusClips from '../data/tideRootColossusClips.generated.json' with { type: 'json' };
import { DRIFTWOOD_REGULAR_ACTORS, DRIFTWOOD_REGULAR_DECISIONS, DRIFTWOOD_REGULAR_FIELDS,
  DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_REWARDS, DRIFTWOOD_REGULAR_SPECIES, DRIFTWOOD_REGULAR_STRIKES } from './driftwoodRegularCombat';
import { TIDAL_GIANTS_ACTORS, TIDAL_GIANTS_BOUNTIES, TIDAL_GIANTS_DECISIONS, TIDAL_GIANTS_FIELDS,
  TIDAL_GIANTS_MOVES, TIDAL_GIANTS_SPECIES, TIDAL_GIANTS_STRIKES } from './tidalGiantsCombat';

const decisions = [...DRIFTWOOD_REGULAR_DECISIONS, ...TIDAL_GIANTS_DECISIONS];
const strikes = [...DRIFTWOOD_REGULAR_STRIKES, ...TIDAL_GIANTS_STRIKES];
const species = [...DRIFTWOOD_REGULAR_SPECIES, ...TIDAL_GIANTS_SPECIES];
const materials = ['driftwood-creature', 'driftwood-creature-glowing',
  'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;

/** Five bounded guests, each with both live and last-good memory. Compiled bytes are charged separately. */
export const DRIFTWOOD_PRACTICE_DECISION_MEMORY = decisions.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);

/** Build-only, isolated practice catalogue. No world generator, placement, save or production inventory is imported. */
export function createDriftwoodPracticeSource(): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Driftwood Combat Practice', author: 'Wildshard', revision: 2, seed: 0x5ea1 });
  return parseShardfile({ ...base,
    state: { ...base.state, shared: [...DRIFTWOOD_REGULAR_FIELDS, ...TIDAL_GIANTS_FIELDS] },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + DRIFTWOOD_PRACTICE_DECISION_MEMORY },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: DRIFTWOOD_PRACTICE_DECISION_MEMORY } },
    look: { ...base.look, materials: Object.fromEntries(materials.map(id => [id, { family: 'graph', graph: authoredGraphs.looks[id] }])) },
    // This is the existing source runtime identity, not a copied runtime or an instruction to boot the island.
    // The standalone practice host owns the scene and consumes these admitted data sections directly.
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'],
      spawns: { homes: [], bosses: [], actors: [...DRIFTWOOD_REGULAR_ACTORS, ...TIDAL_GIANTS_ACTORS] } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: {
        tables: [{ id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
          rows: Object.entries({ ...DRIFTWOOD_REGULAR_REWARDS, ...TIDAL_GIANTS_BOUNTIES })
            .map(([kind, count]) => ({ item: 'coin', weight: 1, count, match: { kind } })) } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] },
        finds: { counters: [], sections: [] }, marks: [],
      } }] },
  });
}

const poses = emitNamedBlobs([
  ['practice/looks.json', practiceLooks], ['practice/bodies.json', creatureBodies],
  ['poses/brine-puffer.json', brinePufferClips], ['poses/conch-duelist.json', conchDuelistClips],
  ['poses/splinter-mantis.json', splinterMantisClips], ['poses/bellback.json', bellbackClips],
  ['poses/tide-root-colossus.json', tideRootColossusClips],
].map(([name, clips]) => {
  if (typeof name !== 'string') throw new Error('Practice pose requires a logical filename');
  return nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(clips)));
}));
const { arms, wood, iron, swim } = heldArms.look.materials;

/** Source-only placeholders are replaced by prepareProjectOutput before any product can pass admission. */
export const DRIFTWOOD_PRACTICE_OUTPUT: ProjectOutput = {
  namedFiles: poses.files, assets: poses.assets,
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['actors/species-programs', { page: [], native: [], program: readSpeciesProgram({
      species: species.map(row => Object.assign(bakeSpecies(row, row.id), { brain: row.brain, body: row.body })), strikes,
    }) }],
    ['actors/moves', [...DRIFTWOOD_REGULAR_MOVES, ...TIDAL_GIANTS_MOVES]],
    ['actors/strikes', strikes], ['sim/scripts', decisions],
    ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } },
      weapons: heldArms.weapons.filter(row => row.blade === 'wood'), cards: [], claims: [] }],
  ])),
};

/** Recompile all five guests against this exact catalogue, then emit and re-read the real SDK product and receipt. */
export async function buildDriftwoodPracticeProduct(project: string, destination: string, options: DecisionBuildOptions): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createDriftwoodPracticeSource();
  const prepared = await prepareProjectOutput(project, DRIFTWOOD_PRACTICE_OUTPUT, { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
