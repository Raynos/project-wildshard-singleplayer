import { expect, it } from 'vitest';
import * as v from 'valibot';
import { SaveStore } from '../src/engine/saves/store';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridReloadExit, GridReloadHandoffSchema, consumeGridReload, gridReloadSlot, validGridReload, type GridReloadHandoff } from '../src/game/grid/reloadHandoff';
import { GridWallet } from '../src/game/grid/wallet';
import { Ledger } from '../src/game/ledger';
import { TEMPLATE_LEDGER } from '../src/shards/_template/data/ledger';
import type { LedgerFact } from '../src/game/shardfile/ledger';
import { ItemRuntime } from '../src/engine/combat/items';
import { PlayerHealth } from '../src/engine/combat/health';
import { Events } from '../src/engine/events/events';
import { Vector3 } from 'three';
import { MemoryStorage } from './setup';

class Storage extends MemoryStorage {
  fail = false;
  override setItem(key: string, value: string): void { if (this.fail) throw new Error('Quota'); super.setItem(key, value); }
}
const assembly = new GridAssembly({ developer: true, devserver: false });
const cell = assembly.cell('template-1');
function handoff(): GridReloadHandoff {
  return { v: 1, mode: 'grid', layout: { developer: true, devserver: false, nineDragon: false }, instance: cell.instance, revision: 1, cell: [...cell.cell],
    roadPose: { x: 277.5, y: 0, z: 0 }, heading: 0.5, mount: 'hoverboard', loadout: { selected: null, tools: [] },
    clock: { version: 1, elapsed: 900, wall: 920, frames: 54000, captureFps: null, paused: false, scale: 1 },
    recovery: { lastSafeRoadPoint: { x: 277.5, z: 0, yaw: 0.5 }, state: 'on-road' }, at: 1000 };
}
function valid(value: GridReloadHandoff): boolean { return validGridReload(value, assembly, () => 1, 1100); }

it.each([false, true])('consumes a device transfer once with grid gate %s and without session storage', (_gates) => {
    const local = new Storage(), slot = gridReloadSlot(new SaveStore({ local, session: null }));
    expect(slot.write(handoff())).toBe(true);
    const boot = gridReloadSlot(new SaveStore({ local, session: new Storage() }));
    expect(consumeGridReload(boot, valid)?.mode).toBe('grid');
    expect(consumeGridReload(gridReloadSlot(new SaveStore({ local, session: null })), valid)).toBeNull();
});
it('refuses unsafe road poses, stale/future records, revision changes and unknown wire fields', () => {
  const value = handoff();
  expect(valid(value)).toBe(true);
  expect(valid({ ...value, roadPose: { x: 0, y: 0, z: 0 } })).toBe(false);
  expect(valid({ ...value, roadPose: { x: 277.5, y: 0, z: 277.5 } })).toBe(false);
  expect(valid({ ...value, roadPose: { ...value.roadPose, y: 4 } })).toBe(false);
  expect(valid({ ...value, at: 2000 })).toBe(false);
  expect(validGridReload(value, assembly, () => 1, 61001)).toBe(false);
  expect(valid({ ...value, revision: 2 })).toBe(false);
  expect(valid({ ...value, cell: [0, 0] })).toBe(false);
  expect(v.safeParse(GridReloadHandoffSchema, { ...value, extra: true }).success).toBe(false);
  expect(v.safeParse(GridReloadHandoffSchema, { ...value, mount: 'horse' }).success).toBe(false);
});
it('holds on checkpoint/write failure, retries and navigates only after the fade', async () => {
  const local = new Storage(), slot = gridReloadSlot(new SaveStore({ local, session: null }));
  let durable = false, held = false, navigations = 0, finish: (() => void) | undefined;
  const exit = new GridReloadExit({ checkpoint: () => durable, slot, hold: (next) => { held = next; },
    fade: () => new Promise<void>((resolve) => { finish = resolve; }), navigate: () => { navigations++; } });
  expect(await exit.start(handoff())).toBe(false); expect(exit.state()).toBe('failed'); expect(held).toBe(true);
  expect(slot.read()).toBeNull(); expect(navigations).toBe(0);
  durable = true; local.fail = true;
  expect(await exit.start(handoff())).toBe(false); expect(navigations).toBe(0);
  expect(gridReloadSlot(new SaveStore({ local, session: null })).read()).toBeNull(); // A kill before durable write.
  local.fail = false;
  const done = exit.start(handoff());
  expect(exit.state()).toBe('saving'); expect(navigations).toBe(0);
  expect(consumeGridReload(gridReloadSlot(new SaveStore({ local, session: null })), valid)).toEqual(handoff()); // Kill after write.
  finish?.(); expect(await done).toBe(true); expect(navigations).toBe(1);
  expect(await exit.start(handoff())).toBe(false); expect(navigations).toBe(1);
});
it('refuses an over-budget planned boot before checkpoint/write/fade/navigation and holds for retry', async () => {
  const slot = gridReloadSlot(new SaveStore({ local: new Storage(), session: null })), calls: string[] = [];
  let admitted = false, held = false;
  const exit = new GridReloadExit({ admit: () => admitted, slot, checkpoint: () => { calls.push('checkpoint'); return true; },
    hold: (value) => { held = value; }, fade: () => { calls.push('fade'); return Promise.resolve(); }, navigate: () => { calls.push('navigate'); } });
  expect(await exit.start(handoff())).toBe(false); expect(exit.state()).toBe('failed'); expect(held).toBe(true);
  expect(calls).toEqual([]); expect(slot.read()).toBeNull();
  admitted = true; expect(await exit.start(handoff())).toBe(true); expect(calls).toEqual(['checkpoint', 'fade', 'navigate']);
});
it('refuses a restore when one-use deletion fails and cancels a U-turn before navigation', async () => {
  const local = new Storage(), slot = gridReloadSlot(new SaveStore({ local, session: null })); slot.write(handoff());
  local.fail = true; expect(consumeGridReload(slot, valid)).toBeNull();
  local.fail = false; slot.write(handoff());
  let finish: (() => void) | undefined, held = false, navigated = false;
  const exit = new GridReloadExit({ checkpoint: () => true, slot, hold: (next) => { held = next; },
    fade: () => new Promise<void>((resolve) => { finish = resolve; }), navigate: () => { navigated = true; } });
  const done = exit.start(handoff());
  local.fail = true; expect(exit.cancel()).toBe(false); expect(held).toBe(true);
  local.fail = false; expect(exit.cancel()).toBe(true); finish?.();
  expect(await done).toBe(false); expect(held).toBe(false); expect(navigated).toBe(false);
  expect(consumeGridReload(gridReloadSlot(new SaveStore({ local, session: null })), valid)).toBeNull();
});
it('preserves the instance wallet across 50 fresh-document transfers without copying or regranting', async () => {
  const local = new Storage(), placement = { id: cell.instance, shard: cell.slug };
  const ledger = (store: SaveStore): Ledger => new Ledger(store, [placement], [{ shard: cell.slug, revision: 1, rules: TEMPLATE_LEDGER }], []);
  const fact: LedgerFact = { instance: cell.instance, shard: cell.slug, revision: 1, entity: 'actor.player', tick: 100, ordinal: 0,
    name: 'template.quest', origin: { kind: 'engine', source: 'quest.complete' } };
  const lantern = (): ItemRuntime => new ItemRuntime({ id: 'tool.template-lantern', kind: 'tool', action: 'template.light', fuelSeconds: 100, intensity: 1 }, {
    actor: new PlayerHealth(new Events(), { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false }),
    combat: { hit: () => null }, targets: () => [], hook: null, effect: () => undefined,
  });
  const firstStore = new SaveStore({ local, session: null }), initial = new GridWallet(firstStore, placement), firstItem = lantern();
  firstItem.queue(3); firstItem.step(0, 1 / 60); firstItem.step(1, 1);
  const fuel = firstItem.remainingFuel;
  initial.addCoins(7); initial.savePack({ counts: { 'shard-token': 3 }, order: ['shard-token'] });
  expect(initial.checkpoint(firstItem.spec.id, new Map([[firstItem.spec.id, firstItem]]))).toBe(true);
  expect(ledger(firstStore).record(fact).status).toBe('granted');
  for (let n = 0; n < 50; n++) {
    const store = new SaveStore({ local, session: null }), wallet = new GridWallet(store, placement);
    const item = lantern(), runtimes = new Map([[item.spec.id, item]]), selected = wallet.restore(runtimes);
    const receipt = ledger(store);
    expect(selected).toBe(firstItem.spec.id); expect(item.remainingFuel).toBe(fuel); expect(item.lightOn).toBe(true);
    const exit = new GridReloadExit({ checkpoint: () => wallet.checkpoint(selected, runtimes) && receipt.flush(), slot: gridReloadSlot(store), hold: () => undefined,
      fade: () => Promise.resolve(), navigate: () => undefined });
    expect(await exit.start(handoff())).toBe(true);
    const reopened = new SaveStore({ local, session: null });
    expect(consumeGridReload(gridReloadSlot(reopened), valid)).toEqual(handoff());
    expect(new GridWallet(reopened, placement).coins()).toBe(7);
    expect(new GridWallet(reopened, placement).pack()).toEqual({ counts: { 'shard-token': 3 }, order: ['shard-token'] });
    expect(ledger(reopened).record(fact).status).toBe('duplicate');
    expect(Object.keys(ledger(reopened).state().facts)).toHaveLength(1);
    expect(Object.values(ledger(reopened).state().achievements)[0]?.count).toBe(1);
  }
});
it('holds while metadata admission is pending and refuses a late completion after disposal', async () => {
  const local = new Storage(), slot = gridReloadSlot(new SaveStore({ local, session: null }));
  let finish: ((value: GridReloadHandoff) => void) | undefined, held = false, checkpoints = 0, navigated = false;
  const exit = new GridReloadExit({ checkpoint: () => { checkpoints++; return true; }, slot, hold: (next) => { held = next; },
    fade: () => Promise.resolve(), navigate: () => { navigated = true; } });
  const done = exit.start(() => new Promise<GridReloadHandoff>((resolve) => { finish = resolve; }));
  expect(held).toBe(true); expect(exit.state()).toBe('saving'); expect(slot.read()).toBeNull();
  expect(exit.cancel()).toBe(true); finish?.(handoff()); expect(await done).toBe(false);
  expect(checkpoints).toBe(0); expect(slot.read()).toBeNull(); expect(navigated).toBe(false);
});
