import { nativeAssemblyFiles, type NativeAssemblyPlan, type ServerBlob } from '@wildshard/sharddev/blobs';
import keeper from '../data/nativeKeeper.json' with { type: 'json' };
import mixedPopulation from '../data/mixedPopulation.json' with { type: 'json' };
import nativePopulationPolicy from '../data/nativePopulationPolicy.json' with { type: 'json' };
import questKillSteps from '../data/questKillSteps.json' with { type: 'json' };
import swords from '../data/nativeSwords.json' with { type: 'json' };
import { CRAB_CLIPS } from './crabClips';
import { ENTRY_WALK } from './entryWalk';
import { PRACTICE_AT } from './enemyPlacement';
import { CAPTAIN_CLIPS, SAILOR_CLIPS } from './humanoidClips';
import { MONKEY_CLIPS } from './monkeyClips';
import { driftwoodNativeRows } from './nativeBake';
import { DRIFTWOOD_NATIVE_QUEST } from './nativeQuest';
import { NATIVE_QUEST_PROPS } from './nativeQuestProps';
import { driftwoodPhysics } from './physics';
import { DRIFTWOOD_SPAWNS } from './spawnTables';
import { DRIFTWOOD_SPOTS } from './spots';

function declared<T>(value: T | undefined, message: string): T { if (value === undefined) throw new Error(message); return value; }

function nativeInputs() {
  return { nativeQuest: { ...DRIFTWOOD_NATIVE_QUEST,
      reward: declared(DRIFTWOOD_NATIVE_QUEST.reward, 'Missing native quest reward'),
      acquisition: declared(DRIFTWOOD_NATIVE_QUEST.acquisition, 'Missing native quest acquisition') },
    nativeQuestSpots: DRIFTWOOD_SPOTS,
    mixedPopulation: { ...mixedPopulation, attackTurnCap: nativePopulationPolicy.attackTurnCap,
      practice: { ...mixedPopulation.practice, at: PRACTICE_AT,
        ...DRIFTWOOD_SPAWNS.find(row => row.id === 'spawn.driftwood.practice')?.respawn },
      poses: [{ kind: 'crab', clips: [CRAB_CLIPS] },
        { kind: 'sailor', clips: [SAILOR_CLIPS], lift: [1.5, 1.5, -2.3, 6] },
        { kind: 'captain', clips: [CAPTAIN_CLIPS] }, { kind: 'monkey', clips: MONKEY_CLIPS }] },
    questProps: NATIVE_QUEST_PROPS, physics: driftwoodNativeRows(driftwoodPhysics()).physics,
    questKillSteps, entries: ENTRY_WALK, swords };
}
/** The typed facts Driftwood's native server hosts read: its bake, roster, quest policy and entry walk. */
export const driftwoodNativeInputs: typeof nativeInputs = nativeInputs;

/** Driftwood's native assembly (P1-E3.1b, J90): its hosts in install order, as data over its product files. */
function driftwoodNativeAssembly(inputs: ReturnType<typeof nativeInputs>): NativeAssemblyPlan {
  const quest = inputs.nativeQuest;
  return { kind: 'native-assembly', level: { speed: 5, ground: { size: 500, height: 0 } }, terrain: { kind: 'bake-ground' }, navigation: 'shard',
    bake: { rows: { file: 'server/physics.json' }, reader: { label: 'Driftwood', resolution: 256, size: 500, parked: false, rig: 'axis', shapes: [1, 2, 9], provenance: 'tagged' },
      ground: 'data/physics-ground.generated.bin', colliders: ['data/physics-colliders.bin'], read: 'solids', keep: ['actors', 'herds', 'habitat', 'captain'] },
    collision: { resolution: 256 }, entries: { walk: inputs.entries },
    features: [{ host: 'day.toon', start: 0.16666666666666669, cycle: 2880, phases: { dusk: 'dusk' } }, { host: 'water.sea', id: 'sea' }, { host: 'collision', skipOnRestore: true }, { host: 'decisions' },
      { host: 'population.mixed', rows: { file: 'server/mixed-population.json' }, perch: { file: 'poses/monkey.json', path: ['program'] }, keeper: { file: 'server/keeper.json' },
        placement: { file: 'sim/enemy-placement.json' }, launch: 'coconut', sea: 'sea' },
      { host: 'quest.chapter', id: quest.reward.director, rows: { file: 'quests/chapter-director.json' }, wake: { file: 'quests/wake-boss.json' }, reward: quest.reward.channels, population: quest.acquisition.population },
      { host: 'commands' }, { host: 'population.reactions' }, { host: 'item.swept', policy: { file: 'server/swords.json' } },
      { host: 'quest.kill-steps', rows: { file: 'server/kill-steps.json' }, counters: { file: 'quests/achievements.json' } }, { host: 'quest.body-scripts' },
      { host: 'quest.composition', table: { file: 'quests/interaction-source.json', path: ['constants', 'interact'] }, rows: { file: 'server/quest-policy.json' }, spots: { file: 'server/quest-spots.json' }, readSpots: true,
        counters: { file: 'quests/achievements.json' }, nativeFeats: true, props: { file: 'server/quest-props.json' }, restoring: true },
      { host: 'population.settle' }, { host: 'population.poses', step: 'driftwood.poses' }] };
}

/** Driftwood's server class (J91): the plan and the rows it names, on no client path. */
export function driftwoodServerFiles(): ServerBlob[] {
  const inputs = driftwoodNativeInputs();
  const rows = new Map<string, unknown>([['server/physics.json', inputs.physics], ['server/mixed-population.json', inputs.mixedPopulation], ['server/keeper.json', keeper], ['server/swords.json', inputs.swords],
    ['server/kill-steps.json', inputs.questKillSteps], ['server/quest-policy.json', inputs.nativeQuest], ['server/quest-spots.json', inputs.nativeQuestSpots], ['server/quest-props.json', inputs.questProps]]);
  return nativeAssemblyFiles(driftwoodNativeAssembly(inputs), rows);
}
