import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SaveStore } from '../src/engine/saves/store';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { PlayerHealth } from '../src/engine/combat/health';
import { InputService } from '../src/engine/input/InputService';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { GridWallet, stowGridEquipment, installGridLoadout } from '../src/game/grid/wallet';
import { installDeclaredItems } from '../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../src/game/systems/items/declared';
import { Ledger } from '../src/game/ledger';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { MemoryStorage } from './setup';
import { app } from '../src/engine/app/runtime';
import { Inventory } from '../src/game/Inventory';
import { Purse } from '../src/game/loot/Purse';
import itemSource from './fixtures/shardfile/items/template.json';

class Storage extends MemoryStorage {
  fail = false;
  override setItem(key: string, value: string): void { if (this.fail) throw new Error('Quota'); super.setItem(key, value); }
}
function items() {
  const scope = new Scope('grid.wallet.fixture'), events = new Events(), input = new InputService(() => 0);
  input.register({ id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'] }, scope);
  const health = new PlayerHealth(events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  const aim = { origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: 1 } };
  const hit = (): null => null;
  const source = structuredClone(itemSource);
  for (const row of source.rows) row.hook = null;
  const declared = installDeclaredItems(source, {
    scope, actorId: health.id, input, aim: () => aim, families: declaredKitItemFamilies(), icon: () => 'sword',
    runtime: () => ({ actor: health, combat: { hit }, targets: () => [], hook: null, effect: () => undefined }),
  });
  if (declared.primary === null) throw new Error('Missing fixture weapon');
  const equipment = new EquipmentService(declared.primary, { scope });
  if (declared.secondary !== null) equipment.add(declared.secondary, { locked: false });
  declared.install(equipment);
  return { scope, declared, equipment, aim };
}
it('shares the production save definitions with the legacy inventory and coin owner', () => {
  const inventory = new Inventory('driftwood-isle'), purse = new Purse('driftwood-isle');
  inventory.add('coconut', 2); purse.add(11);
  const wallet = new GridWallet(app.saves, { id: 'driftwood-isle', shard: 'driftwood-isle' });
  expect(wallet.coins()).toBe(11); expect(wallet.pack().counts['coconut']).toBe(2);
  expect(wallet.flush()).toBe(true);
});
it('keeps shard coins/items isolated and first-party grid/Select saves on the same stable identity', () => {
  const local = new Storage(), store = new SaveStore({ local, session: null });
  const driftwood = new GridWallet(store, { id: 'driftwood-isle', shard: 'driftwood-isle' });
  driftwood.addCoins(37); driftwood.savePack({ counts: { coconut: 3, 'crab-claw': 2 }, order: ['crab-claw', 'coconut'] });
  const pine = new GridWallet(store, { id: 'pine-hollow', shard: 'pine-hollow' });
  expect(pine.coins()).toBe(0); expect(pine.pack()).toEqual({ counts: {}, order: [] });
  pine.addCoins(4);
  const freshDocument = new GridWallet(new SaveStore({ local, session: null }), { id: 'driftwood-isle', shard: 'driftwood-isle' });
  expect(freshDocument.coins()).toBe(37); expect(freshDocument.pack()).toEqual(driftwood.pack());
  expect(new GridWallet(store, { id: 'template-1', shard: '_template' }).coins()).toBe(0);
  expect(new GridWallet(store, { id: 'template-2', shard: '_template' }).pack()).toEqual({ counts: {}, order: [] });
});
it('stows the real kit weapon and cancels held/queued attacks while retaining fuel and selection across reload', () => {
  const local = new Storage(), wallet = new GridWallet(new SaveStore({ local, session: null }), { id: 'template-1', shard: '_template' });
  const source = items(), restored = items();
  try {
    const weapon = source.declared.runtimes.get('weapon.template-whip'), lantern = source.declared.runtimes.get('tool.template-lantern');
    if (weapon === undefined || lantern === undefined) throw new Error('Missing runtime');
    lantern.queue(3); source.declared.step(1, 1 / 60);
    source.equipment.adsHeld = true; source.declared.step(2, 1 / 60); weapon.queue(1, source.aim);
    const fuel = lantern.remainingFuel; stowGridEquipment(source.equipment, source.declared.runtimes);
    expect(source.equipment.stowed).toBe(true); expect(source.equipment.current.enabled).toBe(false);
    source.equipment.update(1 / 60, 0);
    expect(source.equipment.current.model.visible).toBe(false);
    expect(source.equipment.adsHeld).toBe(false); expect(weapon.snapshot()).toMatchObject({ held: false, chargeTime: 0, pending: [] });
    expect(source.equipment.tools.every((tool) => !tool.enabled)).toBe(true);
    expect(wallet.checkpoint(source.equipment.current.row.id, source.declared.runtimes)).toBe(true);
    const reload = new GridWallet(new SaveStore({ local, session: null }), { id: 'template-1', shard: '_template' });
    expect(reload.restore(restored.declared.runtimes)).toBe('weapon.template-whip');
    expect(restored.declared.runtimes.get('tool.template-lantern')?.remainingFuel).toBe(fuel);
    expect(restored.declared.runtimes.get('tool.template-lantern')?.lightOn).toBe(true);
    expect(restored.declared.runtimes.get('weapon.template-whip')?.snapshot().pending).toEqual([]);
    restored.declared.step(1, 1 / 60);
    expect(restored.declared.runtimes.get('tool.template-lantern')?.remainingFuel).toBeLessThan(fuel);
  } finally { source.scope.dispose(); restored.scope.dispose(); }
});
it('keeps a held catalogue weapon equipped while stowing source-local tools', () => {
  const source = items();
  try {
    const localTools = new Map([...source.declared.runtimes].filter(([id]) => id.startsWith('tool.')));
    stowGridEquipment(source.equipment, localTools);
    expect(source.equipment.stowed).toBe(false); expect(source.equipment.current.enabled).toBe(true);
    expect(source.equipment.current.model.visible).toBe(true);
    expect(source.equipment.tools.every((tool) => !tool.enabled)).toBe(true);
  } finally { source.scope.dispose(); }
});
it('restores the held local selection and preserves pre-existing pause/dialogue stow on border return', () => {
  const store = new SaveStore({ local: new Storage(), session: null }), wallet = new GridWallet(store, { id: 'template-1', shard: '_template' });
  const source = items(), target = items();
  try {
    const secondary = source.equipment.list[1]; if (secondary === undefined) throw new Error('Missing second weapon');
    source.equipment.select(secondary.id, true);
    const outgoing = installGridLoadout(wallet, source.equipment, source.declared.runtimes, source.scope);
    outgoing.stow(); expect(outgoing.checkpoint()).toBe(true);
    const incoming = installGridLoadout(wallet, target.equipment, target.declared.runtimes, target.scope);
    expect(target.equipment.current.row.id).toBe(secondary.row.id);
    target.equipment.stowed = true; target.equipment.visible = false;
    incoming.stow(); incoming.stow(); incoming.interior();
    expect(target.equipment.stowed).toBe(true); expect(target.equipment.visible).toBe(false);
    target.equipment.stowed = false; target.equipment.visible = true;
    incoming.stow(); incoming.interior(); expect(target.equipment.current.enabled).toBe(true); expect(target.equipment.visible).toBe(true);
  } finally { source.scope.dispose(); target.scope.dispose(); }
});
it('does not replace travelling profile equipment with a destination saved shard selection', () => {
  const store = new SaveStore({ local: new Storage(), session: null }), wallet = new GridWallet(store, { id: 'template-1', shard: '_template' });
  const source = items(), target = items();
  try {
    wallet.checkpoint(source.equipment.current.row.id, source.declared.runtimes);
    const catalogue = new EmptyEquipment(); target.equipment.add(catalogue, { locked: false }); target.equipment.select(catalogue.id, true);
    const binding = installGridLoadout(wallet, target.equipment, target.declared.runtimes, target.scope);
    expect(target.equipment.current).toBe(catalogue); binding.stow(); expect(target.equipment.stowed).toBe(false);
    expect(target.equipment.current).toBe(catalogue); expect(binding.checkpoint()).toBe(true);
  } finally { source.scope.dispose(); target.scope.dispose(); }
});
it('retries durable checkpoints without granting or moving any coins/items twice', () => {
  const local = new Storage(), wallet = new GridWallet(new SaveStore({ local, session: null }), { id: 'template-1', shard: '_template' });
  local.fail = true; expect(wallet.addCoins(9)).toBe(false);
  expect(wallet.savePack({ counts: { shardToken: 2 }, order: ['shardToken'] })).toBe(false);
  for (let tick = 0; tick < 10; tick++) expect(wallet.checkpoint(null, new Map())).toBe(false);
  expect(wallet.coins()).toBe(9); local.fail = false; expect(wallet.checkpoint(null, new Map())).toBe(true);
  const reload = new GridWallet(new SaveStore({ local, session: null }), { id: 'template-1', shard: '_template' });
  expect(reload.coins()).toBe(9); expect(reload.pack().counts).toEqual({ shardToken: 2 });
});
it('flushes a failed reward write without erasing the saved local loadout', () => {
  const local = new Storage(), wallet = new GridWallet(new SaveStore({ local, session: null }), { id: 'template-1', shard: '_template' });
  const source = items(), target = items();
  try {
    const selected = source.equipment.current.row.id;
    expect(wallet.checkpoint(selected, source.declared.runtimes)).toBe(true);
    local.fail = true;
    expect(wallet.addCoins(13)).toBe(false);
    expect(wallet.flush()).toBe(false);
    local.fail = false;
    expect(wallet.flush()).toBe(true);
    const reload = new GridWallet(new SaveStore({ local, session: null }), { id: 'template-1', shard: '_template' });
    expect(reload.coins()).toBe(13);
    expect(reload.restore(target.declared.runtimes)).toBe(selected);
  } finally { source.scope.dispose(); target.scope.dispose(); }
});
it('leaves travelling catalogue gear and achievements in the same profile across local wallet checkpoints', () => {
  const local = new Storage(), store = new SaveStore({ local, session: null });
  const instances = [{ id: 'template-1', shard: 'template' }, { id: 'template-2', shard: 'template' }];
  const origin = { kind: 'engine' as const, source: 'quest.complete' };
  const rules = [{ fact: 'complete', origin, rewards: [{ kind: 'catalogue' as const, item: 'gear.sword', tier: 1, quantity: 1 },
    { kind: 'achievement' as const, id: 'clear', title: 'CLEAR', threshold: 1 }] }];
  const ledger = new Ledger(store, instances, [{ shard: 'template', revision: 1, rules }], [{ id: 'gear.sword', maxTier: 1 }]);
  ledger.record({ instance: 'template-1', shard: 'template', revision: 1, entity: 'player', tick: 1, ordinal: 0, name: 'complete', origin });
  const profile = local.getItem('wildshard.save.v2.profile');
  for (const instance of instances) new GridWallet(store, instance).checkpoint(null, new Map());
  expect(local.getItem('wildshard.save.v2.profile')).toBe(profile);
  const reload = new Ledger(new SaveStore({ local, session: null }), instances, [{ shard: 'template', revision: 1, rules }], [{ id: 'gear.sword', maxTier: 1 }]);
  expect(reload.state()).toEqual(ledger.state()); expect(Object.values(reload.state().items)[0]?.quantity).toBe(1);
  expect(Object.values(reload.state().achievements)[0]?.earned).toBe(true);
});
