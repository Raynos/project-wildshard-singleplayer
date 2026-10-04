// oxlint-disable-next-line import/no-nodejs-modules -- Restore the actual admitted template modules and Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { ItemRuntime, scriptItemHook } from '../src/engine/combat/items';
import { loadRapier } from '../src/engine/physics/rapier';
import { SaveStore } from '../src/engine/saves/store';
import { instanceSave } from '../src/game/instanceSaves';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { syncTargetColliders } from '../src/game/shardfile/targets';
import { captureClientState, restoreClientState, installClientItemState, clientStateSave } from '../src/game/shardfile/clientState';
import { projectItemFields } from '../src/game/shardfile/clientItems';
import source from '../src/shards/_template/shard.config';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
function boot() {
  let grants = 0;
  const sim = createShardfileSim(source, assets, { rapier, quest: { fact: () => { grants++; }, coins: () => undefined } });
  const lane = sim.lane, player = sim.actors.get(sim.host.player.id);
  if (lane === undefined || player === undefined) throw new Error('Missing template script owner');
  const items = new Map(source.items.rows.map((row) => [row.id, new ItemRuntime(row, { actor: sim.host.player.health, combat: sim.host.combat, targets: () => [], effect: () => undefined,
    hook: row.hook === null ? null : scriptItemHook(lane.host, row.hook.module, row.hook.entity, row.hook.event, sim.host.player.id),
  })]));
  installClientItemState(sim, items, () => {
    for (const runtime of items.values()) runtime.step(sim.host.state.tick, 1 / 60);
    projectItemFields(source, items, lane, player);
  });
  const lamp = items.get('tool.template-lantern'); if (lamp === undefined) throw new Error('Missing template lantern');
  const step = (ticks: number) => { for (let i = 0; i < ticks; i++) sim.host.step(); };
  return { sim, items, lane, player, lamp, step, grants: () => grants };
}
it('restores open-door physics, burning fuel, a queued refill and completed quest without granting twice', () => {
  const first = boot(), next = boot();
  try {
    first.lane.enqueue({ type: 201, target: first.player, value: 1 }); first.lamp.queue(3); first.step(90);
    for (const flag of source.quests.flags) first.sim.host.flags.set(flag);
    expect(first.sim.quest.quests[0]?.isComplete).toBe(true); expect(first.grants()).toBe(1);
    first.lamp.queue(4);
    const store = new SaveStore({ local: null, session: null }), identity = { id: 'template-copy', shard: source.identity.slug };
    const saved = instanceSave(store, clientStateSave, identity); saved.write(captureClientState(source, first.sim, first.items));
    expect(restoreClientState(source, next.sim, next.items, saved.read())).toBe(true);
    syncTargetColliders(source.targets, next.sim.colliders, (scope, id) => {
      const field = source.state[scope].find((row) => row.id === id); if (field === undefined) throw new Error('Missing field');
      return next.lane.world.view(next.sim.host.player.id)[scope][field.name] ?? 0;
    });
    expect(next.sim.colliders.get('template.door')?.active()).toBe(false);
    expect(next.lamp.snapshot()).toEqual(first.lamp.snapshot()); expect(next.lamp.remainingFuel).toBeLessThan(1);
    expect(next.sim.quest.quests[0]?.isComplete).toBe(true); expect(next.grants()).toBe(0);
    first.step(1); next.step(1);
    expect(next.lamp.remainingFuel).toBe(1); expect(next.lamp.lightOn).toBe(true);
    expect(next.lamp.snapshot()).toEqual(first.lamp.snapshot()); expect(next.grants()).toBe(0);
    expect(instanceSave(store, clientStateSave, { ...identity, id: 'independent-copy' }).read()).toBeNull();
  } finally { next.sim.dispose(); first.sim.dispose(); }
});
it('rejects a late incompatible item state atomically after script fields have been restored', () => {
  const first = boot(), next = boot();
  try {
    first.lane.enqueue({ type: 201, target: first.player, value: 1 }); first.step(3);
    const before = captureClientState(source, next.sim, next.items), corrupt = captureClientState(source, first.sim, first.items);
    const weapon = corrupt.items['weapon.template-whip']; if (weapon === undefined) throw new Error('Missing weapon checkpoint'); weapon.lit = true;
    expect(restoreClientState(source, next.sim, next.items, corrupt)).toBe(false);
    expect(captureClientState(source, next.sim, next.items)).toEqual(before);
    expect(restoreClientState(source, next.sim, next.items, { ...before, revision: before.revision + 1 })).toBe(false);
  } finally { next.sim.dispose(); first.sim.dispose(); }
});
