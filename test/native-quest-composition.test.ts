// oxlint-disable-next-line import/no-nodejs-modules -- Compose the native owners over real Rapier.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { installCableModes, cableModes } from '../src/engine/player/modes';
import { installMixedPopulation } from '../src/game/population/mixedRoster';
import { installNativeQuestComposition, readNativeQuestSpots } from '../src/game/quest/nativeComposition';
import { installNativeQuestChannels, registerNativeQuestInputs } from '../src/game/quest/nativeInputs';
import { installNativeItems, createNativeCombatFrame } from '../src/game/plugin/nativeItems';
import { DirectorScriptStageLane, prepareEmbeddedDirector } from '../src/game/plugin/director';
import { parseQuestHost } from '../src/format/questHost';
import { parseAchievementCounterData } from '../src/format/achievementCounters';
import { orchardPopulation } from './fixtures/mixed-population';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import product from '../src/shards/driftwood-isle/generators/product';
import policy from '../src/shards/driftwood-isle/data/nativeQuest.json' with { type: 'json' };
import swords from '../src/shards/driftwood-isle/data/nativeSwords.json' with { type: 'json' };
import declaration from '../src/shards/driftwood-isle/data/director.json' with { type: 'json' };
import module from '../src/shards/driftwood-isle/behaviour/director.json' with { type: 'json' };
import stages from '../src/shards/driftwood-isle/data/finaleStages.json' with { type: 'json' };
import bindings from '../src/shards/driftwood-isle/data/directorBindings.json' with { type: 'json' };
import { DRIFTWOOD_MODES } from '../src/shards/driftwood-isle/generators/modes';

const level = { ...SIM_LEVEL, entities: [], quests: [] };
test('an orchard quest resolves native services by ids and restores carried reward and prop handles', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))), create = await prepareEmbeddedDirector(declaration, module, 5);
  const firstMode = DRIFTWOOD_MODES.traverse[0]; if (firstMode?.kind !== 'zipline') throw new Error('Missing cable profile');
  const mode = { ...firstMode, id: 'orchard.cable', top: { x: 0, y: 8, z: 0 }, bottom: { x: 0, y: 0, z: 10 } };
  const hostRow = parseQuestHost({ version: 1, drive: 'external', actors: { ids: [], error: 'Missing body' },
    graph: { actor: 'orchard.interact', step: 'orchard.graph', actions: [] }, interactions: { marks: [], rows: [] }, npcs: [], observations: [], stages: [], summons: [],
    commands: { step: 'orchard.commands', inputs: {}, routes: [{ value: 1, spot: 'orchard.claim', when: 'true', action: { kind: 'owner', id: 'orchard.claim' } }] } });
  const source = { ...product, questHost: hostRow, quests: { flags: [], quests: [], triggers: [], dialogue: [] } };
  const rows = { ...policy, actor: 'orchard.interact', step: 'orchard.quest', population: 'orchard.population', equipment: 'orchard.equipment', director: 'orchard.director', cable: mode.id,
    heldId: 'orchard.claim', guardKind: 'unseen', reward: { channels: 'orchard.reward', field: 'started', complete: 'orchard.complete' }, rewardFlag: 'orchard.reward.seen',
    barrelOwner: { kind: 'barrel', id: 'orchard.crate' }, keyDrop: { id: 'orchard.token', kind: 'orchard-hog' } };
  const spots = readNativeQuestSpots({ version: 1, rows: [], talk: { x: 30, y: 1, z: 0, radius: 2, label: 'Talk' }, sword: { x: 0, y: 1.68, z: 1, radius: 3, label: 'Claim' },
    reward: { x: 6, y: 0, z: 5, yaw: 1, pitch: 0, phase: .5 }, promptRegistrations: [{ id: rows.heldId, position: { x: 0, y: 1.68, z: 1 }, radius: 3, sight: { slack: 0 } }],
    zipline: { top: mode.top, bottom: mode.bottom, sag: mode.sag, prompt: { x: 0, y: 5, z: 0, radius: 3 } } });
  const counters = parseAchievementCounterData({ feats: [], flags: [], prefix: 'orchard', floorTotals: false, validateTotals: false, write: 'each' });
  const props = { water: -10, floors: [], drops: [{ id: rows.keyDrop.id, kind: rows.keyDrop.kind }], plates: [], gates: [],
    barrels: [{ id: rows.barrelOwner.id, home: { x: 10, y: 0, z: 2 }, yaw: 0, leash: 6, owner: rows.barrelOwner }] };
  const install = (host: ReturnType<typeof createSimHost>, saved?: ReturnType<typeof snapshotSimHost>) => {
    const population = installMixedPopulation(host, orchardPopulation(), saved); installCableModes(host.scope, [mode], host.flags).bindNative(host);
    const frame = createNativeCombatFrame(); const equipment = installNativeItems(host, frame, { kind: 'swept', items: source.items.rows, policy: { ...swords, step: rows.equipment } });
    let commands = [{ actorId: rows.actor, value: 1 }];
    registerNativeQuestInputs(host, { scripts: () => commands, walk: () => ({ x: 0, z: 0 }), ledger: { fact: () => undefined, coins: () => undefined } });
    const reward = installNativeQuestChannels(host, rows.reward.channels, { started: false, completed: false });
    DirectorScriptStageLane.bind(stages, create(), { observations: { altar: 0, dead: 0, seen: 0, 'player-x': 30, 'player-z': 30, 'reward-x': 0, 'reward-z': 0 },
      actions: { 'captain.restore': [], 'captain.wake': [], 'captain.dead': [], 'reward.start': bindings.actions['reward.start'], 'reward.finish': bindings.actions['reward.finish'] },
      changes: [], source: 'optional', initialDt: 0 }, new Map<string, unknown>([['reward', reward], ['flags', host.flags]]), host.scope, saved !== undefined, host, rows.director);
    installNativeQuestComposition(host, { source, rows, spots, props, counters, feats: [], table: { external: [], rows: [] }, restoring: saved !== undefined }); population.settle();
    return { equipment, reward, release: () => { commands = []; } };
  };
  const host = createSimHost(level, { rapier }); let fork: ReturnType<typeof createSimHost> | undefined;
  try {
    const state = install(host); expect(state.reward['completed']).toBe(false); host.step(); expect(state.equipment.held()).toBe(1); state.release();
    state.reward['started'] = true; host.step();
    const saved = snapshotSimHost(host); expect(cableModes(host.scope).nativeRider(mode.id).carried).toBe(true);
    fork = restoreSimHost(level, { rapier }, saved, fresh => { install(fresh, saved).release(); });
    expect(snapshotSimHost(fork)).toEqual(saved);
  } finally { host.dispose(); fork?.dispose(); }
});
