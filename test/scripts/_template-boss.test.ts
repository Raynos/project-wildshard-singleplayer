import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the producer's small immutable Wasm, never compile in the gate scenario.
import { readFileSync } from 'node:fs';
import { DecisionHost, type DecisionScript } from '@wildshard/engine/script/decision';
import { decisionScriptRules } from '@wildshard/format/decisionScripts';
import { admitScriptContract } from '@wildshard/format/scriptContract';
import { createScriptScenario } from '@wildshard/sdk/scriptScenario';
import { outputDecisionScripts } from '@wildshard/sdk/outputProduct';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { BOSS_MOVES, BOSS_REGISTRIES, bossBindingMap } from '../../src/shards/_template/data/bossDecision';
import { output } from '../../src/shards/_template/generators/output';
import product from '../../src/shards/_template/generators/product';
import module from '../../src/shards/_template/behaviour/boss.json';

test('Template boss runs admitted Wasm decisions and resumes a logical save', () => {
  const row = outputDecisionScripts(output.platform)[0];
  if (row === undefined) throw new Error('Template output has no decision script');
  const bytes = new Uint8Array(readFileSync(`src/shards/_template/assets/${module.hash}`));
  expect(hashImmutableBytes(bytes)).toBe(module.hash);
  expect(admitScriptContract(bytes, { abi: 1, pages: 1 }).initialPages).toBe(1);
  expect(row.binding).toEqual({ encounter: 'template.boss' });
  expect(product.runtime).toBeNull();
  expect(product.sim.scripts).not.toContain(module.hash); // Separate from the legacy v0 host.
  expect(decisionScriptRules([row], {
    modules: new Map([[row.module, { abi: 1, pages: 1 }]]),
    ids: { actors: new Set(product.creatures.spawns.map(actor => actor.id)),
      strikes: new Set(product.rows.strikes.map(strike => strike.id)), moves: new Set(BOSS_MOVES.map(move => move.id)) },
    bindings: { encounters: new Set(product.encounters.map(encounter => encounter.id)), quests: new Set(), zones: new Set() }, migrations: [],
  })).toEqual([]);
  const map = bossBindingMap(row.module);
  const script: DecisionScript = { ...row, ids: map.ids, reads: ['nearestPlayer'], lists: [], state: row.state.map(slot => {
    if (slot.scope === 'local') throw new Error('Template simulation has no local-only state');
    return { ...slot, scope: slot.scope };
  }) };
  const boss = BOSS_REGISTRIES.actors.get('big-blob');
  if (boss === undefined) throw new Error('Missing bound boss');
  const create = () => createScriptScenario(DecisionHost, { script, bytes, seed: 437,
    binding: { id: 1, script: row.id, self: boss, actors: [boss], instance: 0 },
    actors: [{ id: boss, at: [-15, 0, -20] }], players: [{ id: 101, at: [-15, 0, -18] }],
  });
  const scenario = create();
  scenario.send('start');
  expect(scenario.commands()).toEqual([['encounter', 'phase', 0], ['move', 'boss', 'approach', 101], ['timer', 'beat', 1]]);
  scenario.send('start'); expect(scenario.commands()).toEqual([]); // No restart while active.
  scenario.advance(1);
  expect(scenario.commands()).toEqual([['strike', 'boss', 'bump', 101], ['timer', 'beat', 1]]);
  scenario.advance(1);
  expect(scenario.commands()).toEqual([['move', 'boss', 'approach', 101], ['timer', 'beat', 1]]);
  scenario.send('threshold', 'boss', 1);
  expect(scenario.commands()).toEqual([['encounter', 'phase', 1], ['timer', 'beat', 0.5]]);
  scenario.send('threshold', 'boss', 1); expect(scenario.commands()).toEqual([]);
  scenario.advance(0.25);
  const saved = scenario.save();
  scenario.advance(0.5);
  const commands = scenario.commands(), state = scenario.state();
  expect(commands).toEqual([['strike', 'boss', 'bump', 101], ['timer', 'beat', 0.5]]);
  // A fresh host restores slots, queued commands and timer remainder, never a Wasm heap image.
  const resumed = create(); resumed.restore(structuredClone(saved));
  resumed.advance(0.5); expect(resumed.commands()).toEqual(commands); expect(resumed.state()).toEqual(state);
  expect(resumed.save()).toEqual(scenario.save());
  resumed.send('death', 'boss');
  expect(resumed.commands()).toEqual([['stop', 'boss'], ['timer', 'beat', 0], ['encounter', 'win', 0]]);
  resumed.send('death', 'boss'); expect(resumed.commands()).toEqual([]);
  resumed.advance(2); expect(resumed.commands()).toEqual([]);
  resumed.send('stop'); expect(resumed.state()).toEqual({ phase: 0, swingNext: true });
  resumed.advance(2); expect(resumed.commands()).toEqual([]);
  resumed.send('start'); expect(resumed.commands()).toEqual([['encounter', 'phase', 0], ['move', 'boss', 'approach', 101], ['timer', 'beat', 1]]);
  resumed.send('stop'); expect(resumed.state()).toEqual({ phase: 0, swingNext: true });
  resumed.advance(2); expect(resumed.commands()).toEqual([]); // Stop cancels an active timer too.
  expect(resumed.host.metrics()[0]).toMatchObject({ refusals: 0, disabled: false });
  expect(resumed.maxFuel()).toBeGreaterThan(0);
  expect(resumed.maxFuel()).toBeLessThan(400_000);
}, 2_000);
