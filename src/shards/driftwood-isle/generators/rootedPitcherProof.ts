import { emptyShardfile } from '@wildshard/sdk/author';
import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import type { DecisionBuildOptions } from '@wildshard/sdk/buildDecisionScripts';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { validateOutputProduct, writeOutputProduct, outputScriptAdmissionRows } from '@wildshard/sdk/outputProduct';
import { admitProduct } from '@wildshard/sdk/productOutput';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { mergeProjectBlobs, prepareProjectOutput, type ProjectOutput } from '@wildshard/sdk/projectOutput';
import { parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { readSpeciesProgram } from '@wildshard/format/speciesPrograms';
import practiceLooks from '../data/practiceLooks.json' with { type: 'json' };
import { brinePitcherNativeOwnerClips } from './brinePitcherNativeOwnerClips';
import pickupCatalogue from '@wildshard/game/data/pickupCatalogue' with { type: 'json' };
import authoredGraphs from '../data/lookGraphs.json' with { type: 'json' };
import heldArms from '../data/heldArms.json' with { type: 'json' };
import practiceLighting from '../data/practiceLighting.json' with { type: 'json' };
import neutralGrayLighting from '../data/practiceNeutralGrayLighting.json' with { type: 'json' };
import { BRINE_PITCHER_ACTORS, BRINE_PITCHER_FIELDS, BRINE_PITCHER_REWARD } from './brinePitcherCombat';

import { BRINE_PITCHER_NATIVE_OWNER_DECISIONS, BRINE_PITCHER_NATIVE_OWNER_STRIKES, BRINE_PITCHER_NATIVE_OWNER_SPECIES } from './brinePitcherNativeOwnerCombat';

type RootedPitcherProofLighting = 'neutral-studio-v1' | 'neutral-gray-v2';
const lightingProfiles = { 'neutral-studio-v1': practiceLighting['neutral-studio-v1'], ...neutralGrayLighting };



const decisions = BRINE_PITCHER_NATIVE_OWNER_DECISIONS;
const strikes = BRINE_PITCHER_NATIVE_OWNER_STRIKES;
const species = BRINE_PITCHER_NATIVE_OWNER_SPECIES.map(row => Object.assign(structuredClone(row), { label: 'WIP ROOTED PITCHER · HELD DEATH/NO FOLD · NOT YET ADMITTED' }));
const materials = ['driftwood-creature', 'driftwood-creature-glowing',
  'driftwood-fp-arms', 'driftwood-fp-wood', 'driftwood-fp-iron', 'driftwood-fp-swim'] as const;

/** One bounded guest, with both live and last-good memory. Compiled bytes are charged separately. */
export const ROOTED_PITCHER_PROOF_DECISION_MEMORY = decisions.reduce((sum, row) => sum + row.pages * 65536 * 2, 0);

/** Build-only, isolated practice catalogue. No world generator, placement, save or production inventory is imported. */
export function createRootedPitcherProofSource(arenaLighting?: RootedPitcherProofLighting): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'WIP ROOTED PITCHER · HELD DEATH/NO FOLD · NOT YET ADMITTED', author: 'Wildshard', revision: 2, seed: 0x5ea1 });
  return parseShardfile({ ...base,
    state: { ...base.state, shared: BRINE_PITCHER_FIELDS },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + ROOTED_PITCHER_PROOF_DECISION_MEMORY },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: ROOTED_PITCHER_PROOF_DECISION_MEMORY } },
    look: { ...base.look,
      ...(arenaLighting === undefined ? {} : { familyLooks: { ...base.look.familyLooks, toon: lightingProfiles[arenaLighting].toon } }),
      materials: Object.fromEntries(materials.map(id => [id, { family: 'graph', graph: authoredGraphs.looks[id] }])) },
    // This is the existing source runtime identity, not a copied runtime or an instruction to boot the island.
    // The standalone practice host owns the scene and consumes these admitted data sections directly.
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns', 'loot'],
      spawns: { homes: [], bosses: [], actors: BRINE_PITCHER_ACTORS } },
    rows: { ...base.rows, loot: [{ id: 'driftwood.practice.loot', gear: 'purse.coins', finds: null, marks: null,
      charted: false, chime: 'cue.loot.chime', economy: {
        tables: [{ id: 'loot.driftwood.coins', domain: 'coins', table: { mode: 'each',
          rows: [{ item: 'coin', weight: 1, count: BRINE_PITCHER_REWARD, match: { kind: 'brine-pitcher-matriarch' } }] } }],
        effects: [], goods: [], grants: { player: [], worn: [], weapons: [] },
        finds: { counters: [], sections: [] }, marks: [],
      } }] },
  });
}

/** Separate product only: never reads or writes the rejected multi-creature generated bake. */
export function createRootedPitcherProofOutput(metadataBytes: Uint8Array): ProjectOutput {
  if (hashImmutableBytes(metadataBytes) !== 'a1badfcd0a4039ca031356b4d5963450e1f3e472ae1ff427f95276da828cfdfa')
    throw new Error('Rooted Pitcher requires exact retained seven-bone metadata');
  const arenaLighting: RootedPitcherProofLighting = 'neutral-gray-v2';
  const looks = [{ id: 'driftwood.look.brine-pitcher-matriarch', species: 'creature.brine-pitcher-matriarch', kind: 'brine-pitcher-matriarch', pose: 'poses/brine-pitcher-native-owner.json', rootFlinch: 'authored-pose', rigContract: { skeleton: 'brine-pitcher-matriarch.native7.v1', clips: [], sockets: ['body','head','leftHead','rightHead','headLid','leftHeadLid','rightHeadLid'] } }];
  const poses = emitNamedBlobs([...[
    ['practice/looks.json', { ...practiceLooks, looks, arenaLighting: { profile: arenaLighting, ...lightingProfiles[arenaLighting].hemisphere } }],
    ['practice/pickups.json', { ...pickupCatalogue, looks: [], geometries: pickupCatalogue.geometries.filter(row => row.key === pickupCatalogue.coin) }],
    ['poses/brine-pitcher-native-owner.json', brinePitcherNativeOwnerClips()],
  ].map(([name, value]) => {
    if (typeof name !== 'string') throw new Error('Preview requires a logical filename');
    return nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(value)));
  }), nameBlob('practice/bodies.json', 'json', metadataBytes)]);
  const { arms, wood, iron, swim } = heldArms.look.materials;

  /** Source-only placeholders are replaced by prepareProjectOutput before any product can pass admission. */
  return {
    namedFiles: poses.files, assets: poses.assets,
    platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
      ['actors/species-programs', { page: [], native: [], program: readSpeciesProgram({
        species: species.map(row => Object.assign(bakeSpecies(row, row.id), { brain: row.brain, body: row.body })), strikes,
      }) }],
      ['actors/moves', []],
      ['actors/strikes', strikes], ['sim/scripts', decisions],
      ['held/arms', { ...heldArms, look: { ...heldArms.look, materials: { arms, wood, iron, swim } },
        weapons: heldArms.weapons.filter(row => row.blade === 'wood'), cards: [], claims: [] }],
    ])),
  };

}

/** Recompile the one BrinePitcher guest against this exact catalogue, then emit and re-read the real SDK product and receipt. */
export async function buildRootedPitcherProofProduct(project: string, destination: string, options: DecisionBuildOptions, metadataBytes: Uint8Array): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createRootedPitcherProofSource('neutral-gray-v2');
  const prepared = await prepareProjectOutput(project, createRootedPitcherProofOutput(metadataBytes), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  admitProduct(merged.shard, merged.assets, 'refuse', outputScriptAdmissionRows(prepared.options.platform));
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
