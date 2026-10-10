import { expect, it } from 'vitest';
import { Scene, Vector3 } from 'three';
import { Flags, test as holds } from '../../../src/engine/world/interact/flags';
import { Interactables, Live } from '../../../src/engine/world/interact/Interactables';
import { flagsRaised, flagsRead } from '../../../src/engine/world/interact/types';
import { Rng } from '../../../src/engine/core/rng';
import { lineFor } from '../../../src/engine/quest/core';
import { InteractionRules } from '../../../src/game/quest/interactionRows';
import { DRIFTWOOD_INTERACT } from '../../../src/shards/driftwood-isle/quest/interactables';
import { DRIFTWOOD_ACTIONS } from '../../../src/shards/driftwood-isle/data/questGraph';
import { CASTAWAY } from '../../../src/shards/driftwood-isle/quest/questLine';
import { SHIPPING_CASTAWAY } from '../../fixtures/quest-oracle/driftwood-castaway';
import { fakeWorld } from '../../fake/world';

it('replays ten thousand flag transitions against the shipping Interactables method, preserving event order', () => {
  const data = DRIFTWOOD_ACTIONS, declaredFlags = new Flags('graph', false), nativeFlags = new Flags('oracle', false);
  const rules = new InteractionRules(declaredFlags, data), rng = new Rng(357);
  // No geometry is built: the oracle calls the real shipping action and radius methods; the sky is never read.
  const native = new Interactables({ scene: new Scene(), sky: fakeWorld().sky,
    player: { position: new Vector3(), velocity: new Vector3() }, flags: nativeFlags,
    place: () => ({ x: 0, y: 0, z: 0, yaw: 0 }), floorAt: () => 0, prompts: [] });
  const eligible = DRIFTWOOD_INTERACT.rows.filter(row => data.rows.some(action => action.id === row.id));
  const vocabulary = [...new Set(DRIFTWOOD_INTERACT.rows.flatMap(row => [...flagsRaised(row), ...flagsRead(row)]))];
  const nativeChanges: string[] = [], declaredChanges: string[] = [];
  nativeFlags.onChange((flag, on) => { nativeChanges.push(`${on ? '+' : '-'}${flag}`); });
  declaredFlags.onChange((flag, on) => { declaredChanges.push(`${on ? '+' : '-'}${flag}`); });
  const chest = { prefix: 0 };
  native.onEvent = event => { if (event.type === 'open') chest.prefix = nativeChanges.length; };
  for (let tick = 0; tick < 10000; tick++) {
    const def = eligible[tick % eligible.length]; if (def === undefined) throw new Error('Missing authored action');
    const initial = vocabulary.filter(() => rng.next() < 0.5);
    nativeFlags.restore(initial); declaredFlags.restore(initial); nativeChanges.length = 0; declaredChanges.length = 0; chest.prefix = 0;
    const live = new Live(def);
    live.shown = !((def.kind === 'key' || def.kind === 'pickup') && nativeFlags.has(`taken:${def.id}`)) && holds(nativeFlags, def.showWhen);
    // oxlint-disable-next-line typescript/dot-notation -- The shipping oracle invokes private production methods without widening their public API.
    if (native['promptRadius'](live) > 0) native['interact'](live);
    rules.run(def.id);
    // Native chest delivery follows its 'open' event; the graph owns exactly the prefix, the existing pack owns delivery.
    expect(declaredChanges, `${tick}:${def.id}`).toEqual(def.kind === 'chest' ? nativeChanges.slice(0, chest.prefix) : nativeChanges);
  }
});

it('keeps physical controllers outside the graph and preserves the winch effect and stable command identities', () => {
  const data = DRIFTWOOD_ACTIONS;
  expect(data.marks).toEqual([]);
  expect(data.rows.map(row => row.id)).not.toEqual(expect.arrayContaining(['tide-barrel', 'tide-plate-a', 'tide-plate-b', 'sluice']));
  expect(data.rows.find(row => row.id === 'hold-winch')?.sets).toEqual(['lever:hold-winch', 'winch:up']);
  for (const row of data.rows) if (row.id !== 'castaway.talk') {
    expect(row.act).toBe(100 + DRIFTWOOD_INTERACT.rows.findIndex(def => def.id === row.id));
  }
});

it('keeps every shipping dialogue branch, line and end flag through ten thousand selections', () => {
  expect(CASTAWAY).toEqual(SHIPPING_CASTAWAY);
  const vocabulary = ['quest:driftwood-done', 'dead:captain', 'used:altar', 'shard:lookout', 'shard:wreck', 'shard:cave', 'talked:castaway'];
  const flags = new Flags('castaway-oracle', false);
  for (let selection = 0; selection < 10000; selection++) {
    flags.restore(vocabulary.filter((_flag, index) => (selection & (1 << index)) !== 0));
    expect(lineFor(CASTAWAY, flags)).toEqual(lineFor(SHIPPING_CASTAWAY, flags));
  }
});
