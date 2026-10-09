// oxlint-disable-next-line import/no-nodejs-modules -- Restore the actual admitted template modules and Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { ItemRuntime, scriptItemHook } from '../src/engine/combat/items';
import { loadRapier } from '../src/engine/physics/rapier';
import { SaveStore } from '../src/engine/saves/store';
import { InputService } from '../src/engine/input/InputService';
import type { DebugRowSpec } from '../src/engine/level/context';
import { instanceSave } from '../src/game/instanceSaves';
import { installDeclaredPlumbing } from '../src/game/shard/declaredPlumbing';
import { installDeclaredItems } from '../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../src/game/systems/items/declared';
import { createShardfileSim } from '../src/game/shardfile/simulation';
import { syncTargetColliders } from '../src/game/shardfile/targets';
import { captureClientState, restoreClientState, installClientItemState, clientStateSave, clientStateFromRegion } from '../src/game/shardfile/clientState';
import { snapshotSimHost } from '../src/engine/sim/snapshot';
import { projectItemFields, handledItemInputs, clientScene } from '../src/game/shardfile/clientItems';
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
it('restores portable health, inactive door, fuel and completed quest in a fresh executable lane without held inputs or repeated grants', () => {
  const first = boot(), next = boot();
  try {
    first.lane.enqueue({ type: 201, target: first.player, value: 1 }); first.lamp.queue(3); first.step(90);
    const blob = first.sim.host.entities.get('grey-blob:1'); if (blob === undefined) throw new Error('Missing blob');
    blob.hp = 55; first.sim.colliders.get('template.door')?.setActive(false);
    for (const flag of source.quests.flags) first.sim.host.flags.set(flag);
    first.lamp.queue(4);
    const portable = clientStateFromRegion(source, snapshotSimHost(first.sim.host), source.identity.revision, source.state.version,
      Object.fromEntries([...first.sim.colliders].map(([id, port]) => [id, port.active()])));
    expect(portable.lane).toBeNull(); expect(restoreClientState(source, next.sim, next.items, portable)).toBe(true);
    expect(next.sim.host.entities.get('grey-blob:1')?.hp).toBe(55);
    expect(next.sim.colliders.get('template.door')?.active()).toBe(false);
    expect(next.lamp.remainingFuel).toBe(first.lamp.remainingFuel);
    expect(next.lamp.snapshot()).toMatchObject({ pending: [], held: false, chargeTime: 0 });
    expect(next.sim.quest.quests[0]?.isComplete).toBe(true); expect(next.grants()).toBe(0);
    blob.hp = 0; blob.alive = false; blob.state = 'dead';
    const dead = clientStateFromRegion(source, snapshotSimHost(first.sim.host));
    expect(restoreClientState(source, next.sim, next.items, dead)).toBe(true);
    next.step(120); expect(next.sim.host.entities.get('grey-blob:1')).toMatchObject({ hp: 0, alive: false, state: 'dead' });
    expect(next.grants()).toBe(0);
  } finally { next.sim.dispose(); first.sim.dispose(); }
});
it('the real item and plumbing installers queue one lantern toggle per input and retain the trusted refill action without a Debug row', () => {
  const sim = createShardfileSim(source, assets, { rapier, quest: { fact: () => undefined, coins: () => undefined } });
  try {
    const input = new InputService(() => sim.host.state.tick * 1000 / 60), lane = sim.lane;
    if (lane === undefined || source.plumbing === null) throw new Error('Missing template lane/plumbing');
    input.register({ id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], keys: {} }, sim.host.scope);
    const items = installDeclaredItems(source.items, { input, scope: sim.host.scope, actorId: sim.host.player.id, families: declaredKitItemFamilies(),
      icon: (name) => { if (name === 'sword' || name === 'glyph') return name; throw new Error('Unknown fixture icon'); },
      aim: () => ({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: -1 } }),
      runtime: (row) => ({ actor: sim.host.player.health, combat: sim.host.combat, targets: () => [], effect: () => undefined,
        hook: row.hook === null ? null : scriptItemHook(lane.host, row.hook.module, row.hook.entity, row.hook.event, sim.host.player.id) }),
    });
    const rows = new Map<string, DebugRowSpec>();
    const scene = clientScene(source, items.runtimes, () => { throw new Error('Unexpected scene'); });
    installDeclaredPlumbing(source.plumbing, { input, scope: sim.host.scope, instance: 'template', tier: 'phone', active: () => true,
      handledInput: handledItemInputs(source), scene, knobs: () => undefined,
      debugRow: (row) => { rows.set(row.id, row); },
    });
    installClientItemState(sim, items.runtimes, () => { items.step(sim.host.state.tick, 1 / 60); });
    const lamp = items.runtimes.get('tool.template-lantern'); if (lamp === undefined) throw new Error('Missing installed lantern');
    input.executeCommand({ kind: 'physical', code: 'KeyL', on: true, at: 0 });
    input.executeCommand({ kind: 'physical', code: 'KeyL', on: false, at: 1 });
    expect(lamp.snapshot().pending).toHaveLength(1); sim.host.step(); expect(lamp.lightOn).toBe(true);
    for (let i = 0; i < 60; i++) sim.host.step(); expect(lamp.remainingFuel).toBeLessThan(1);
    expect(rows.size).toBe(0); scene('template.lantern.refill'); sim.host.step(); expect(lamp.remainingFuel).toBe(1);
    input.press('template.lantern.toggle'); sim.host.step(); expect(lamp.lightOn).toBe(false);
    expect(input.touchLayout().verbs['verb.1']).toMatchObject({ action: 'template.lantern.toggle', label: 'LANTERN' });
    const before = lamp.snapshot(); sim.dispose(); input.press('template.lantern.toggle'); expect(lamp.snapshot()).toEqual(before);
  } finally { sim.dispose(); }
});
