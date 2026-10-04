// oxlint-disable-next-line import/no-nodejs-modules -- Real admitted template assets and the shipped physics binary exercise revision migration in Node.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { ItemRuntime, scriptItemHook } from '../src/engine/combat/items';
import { SaveStore } from '../src/engine/saves/store';
import { instanceSave } from '../src/game/instanceSaves';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { captureClientState, restoreClientState, installClientItemState, clientStateSave } from '../src/game/shardfile/clientState';
import { projectItemFields } from '../src/game/shardfile/clientItems';
import { syncTargetColliders } from '../src/game/shardfile/targets';
import { parseMigrations } from '../src/game/shardfile/migrations';
import type { Shardfile } from '../src/game/shardfile/schema';
import source from '../src/shards/_template/shard.config';
import { MemoryStorage } from './setup';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
function boot(declaration: Shardfile = source) {
  let grants = 0;
  const sim = createShardfileSim(declaration, assets, { rapier, quest: { fact: () => { grants++; }, coins: () => undefined } }), lane = sim.lane;
  if (lane === undefined) throw new Error('Missing real template lane');
  const player = sim.actors.get(sim.host.player.id); if (player === undefined) throw new Error('Missing player');
  const items = new Map(declaration.items.rows.map((row) => [row.id, new ItemRuntime(row, { actor: sim.host.player.health, combat: sim.host.combat, targets: () => [], effect: () => undefined,
    hook: row.hook === null ? null : scriptItemHook(lane.host, row.hook.module, row.hook.entity, row.hook.event, sim.host.player.id),
  })]));
  installClientItemState(sim, items, () => { for (const item of items.values()) item.step(sim.host.state.tick, 1 / 60); projectItemFields(declaration, items, lane, player); });
  const lamp = items.get('tool.template-lantern'); if (lamp === undefined) throw new Error('Missing lantern');
  const step = (ticks: number) => { for (let i = 0; i < ticks; i++) sim.host.step(); };
  return { sim, lane, player, items, lamp, step, grants: () => grants };
}
function revision() {
  const migrations = parseMigrations([{ from: 1, to: 2, fields: [{ op: 'rename', scope: 'shared', id: 101, name: 'template.gate.open' },
    { op: 'default', scope: 'shared', field: { id: 303, name: 'checkpoint.added', type: 'f64', value: 0.4 } }] }]);
  return { ...source, identity: { ...source.identity, revision: source.identity.revision + 1 }, migrations,
    state: { ...source.state, version: 2, shared: [...source.state.shared.map((field) => ({ ...field, name: field.id === 101 ? 'template.gate.open' : field.name })),
      { id: 303, name: 'checkpoint.added', type: 'f64' as const, privacy: 'public' as const, default: 0.25 }] } };
}
it('migrates a real saved door, burning lantern and completed quest into a freshly built revision without replaying rewards or old executable/physics state', () => {
  const first = boot(), nextSource = revision(), next = boot(nextSource);
  try {
    first.lane.enqueue({ type: 201, target: first.player, value: 1 }); first.lamp.queue(3); first.step(90);
    for (const flag of source.quests.flags) first.sim.host.flags.set(flag);
    expect(first.grants()).toBe(1); first.lamp.queue(4); first.sim.host.player.position.x += 5;
    const local = new MemoryStorage(), store = new SaveStore({ local, session: null }), identity = { id: 'template-1', shard: source.identity.slug };
    const slot = instanceSave(store, clientStateSave, identity); slot.write(captureClientState(source, first.sim, first.items));
    const freshExecution = next.lane.host.checkpoint();
    expect(restoreClientState(nextSource, next.sim, next.items, slot.read())).toBe(true);
    expect(next.lane.host.checkpoint()).toEqual(freshExecution); expect(next.sim.host.player.position.x).toBe(source.spawn.x);
    expect(next.lane.world.view(next.sim.host.player.id).shared).toMatchObject({ 'template.gate.open': 1, 'checkpoint.added': 0.4 });
    expect(next.lamp.remainingFuel).toBe(first.lamp.remainingFuel); expect(next.lamp.lightOn).toBe(true); expect(next.lamp.snapshot().pending).toEqual([]);
    expect(next.sim.quest.quests[0]?.isComplete).toBe(true); expect(next.grants()).toBe(0);
    syncTargetColliders(nextSource.targets, next.sim.colliders, (scope, id) => {
      const field = nextSource.state[scope].find((row) => row.id === id); if (field === undefined) throw new Error('Missing state field');
      return next.lane.world.view(next.sim.host.player.id)[scope][field.name] ?? 0;
    });
    expect(next.sim.colliders.get('template.door')?.active()).toBe(false);
    next.step(1); expect(next.grants()).toBe(0); expect(slot.write(captureClientState(nextSource, next.sim, next.items))).toBe(true);
    expect(instanceSave(store, clientStateSave, { ...identity, id: 'template-2' }).read()).toBeNull();
  } finally { next.sim.dispose(); first.sim.dispose(); }
});
it('upgrades the shipped version-1 checkpoint without rewriting it during read or losing original bytes on failure', () => {
  const first = boot(), nextSource = revision(), next = boot(nextSource);
  try {
    first.lane.enqueue({ type: 201, target: first.player, value: 1 }); first.step(3);
    const current = captureClientState(source, first.sim, first.items); if (current.version !== 2) throw new Error('Missing portable checkpoint');
    const { shard, state, ...legacy } = current;
    expect(shard).toBe(source.identity.slug); expect(state.version).toBe(1);
    const local = new MemoryStorage(), bytes = JSON.stringify({ keys: { 'platform.continuation': { v: 1, data: { ...legacy, version: 1 } } } });
    local.setItem('wildshard.save.v2.template-1', bytes);
    const store = new SaveStore({ local, session: null }), slot = instanceSave(store, clientStateSave, { id: 'template-1', shard: source.identity.slug });
    expect(restoreClientState(nextSource, next.sim, next.items, slot.read())).toBe(true); expect(local.getItem('wildshard.save.v2.template-1')).toBe(bytes);
  } finally { next.sim.dispose(); first.sim.dispose(); }
});
it('refuses an unadmitted revision change atomically and never interprets another shard or a future revision as fresh progress', () => {
  const first = boot(), nextSource = revision(), next = boot(nextSource);
  try {
    const state = captureClientState(source, first.sim, first.items), before = captureClientState(nextSource, next.sim, next.items);
    expect(restoreClientState({ ...nextSource, migrations: [] }, next.sim, next.items, state)).toBe(false);
    expect(captureClientState(nextSource, next.sim, next.items)).toEqual(before);
    expect(restoreClientState(nextSource, next.sim, next.items, { ...state, shard: 'another-shard' })).toBe(false);
    expect(restoreClientState(nextSource, next.sim, next.items, { ...state, revision: nextSource.identity.revision + 1 })).toBe(false);
  } finally { next.sim.dispose(); first.sim.dispose(); }
});
