// oxlint-disable-next-line import/no-nodejs-modules -- Fixture source/binary reads are Node-only test inputs.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { compileScript } from '../../scripts/compile-script.mjs';
import { scriptSource } from '../script/fixture';
import { loadRapier } from '../../src/engine/physics/rapier';
import { createSimHost } from '../../src/engine/sim';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { DeclaredScriptWorld } from '../../src/engine/script/state';
import { ScriptHost } from '../../src/engine/script/host';
import { scriptItemHook } from '../../src/engine/combat/items';
import { InputService } from '../../src/engine/input/InputService';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { installDeclaredItems, parseItems, itemRules, declaredItemScriptEntities } from '../../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../../src/game/systems/items/declared';
import type { EquipmentIcon } from '../../src/engine/combat/Equipment';
import itemSource from '../fixtures/shardfile/items/template.json';
import { ITEMS } from '../../src/shards/_template/data/items';

let rapier: Awaited<ReturnType<typeof loadRapier>>, bytes: Uint8Array;
beforeAll(async () => {
  rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  bytes = await compileScript(readFileSync('test/fixtures/shardfile/items/hooks.as', 'utf8'));
  const hash = itemSource.rows[0]?.hook?.module; if (hash === undefined) throw new Error('Hook missing');
  expect(Array.from(readFileSync(`src/shards/_template/assets/${hash}`))).toEqual(Array.from(bytes));
  expect(ITEMS).toEqual(itemSource);
});
function fixture(hookBytes = bytes) {
  const spawn = SIM_LEVEL.entities[0]; if (spawn === undefined) throw new Error('Fixture creature missing');
  const sim = createSimHost({ ...SIM_LEVEL, entities: [{ ...spawn, strike: undefined }].map(({ strike: _strike, ...rest }) => rest), quests: [] }, { rapier });
  const target = sim.entities.get(spawn.id); if (target === undefined) throw new Error('Fixture target missing');
  target.place(0, 1.6, Math.PI); const input = new InputService(() => sim.state.tick * 1000 / 60);
  input.register({ id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], keys: { attack: ['Mouse0'], heavy: ['Mouse2'] } }, sim.scope);
  const world = new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [101, 102], maxEntities: 8 }, [1001, 1002].map((id) => ({ id, name: `item ${id}`, position: [0, 0, 0], fields: {}, frozen: false, interactive: true })), { shared: [], player: [] }, new Map([[1001, sim.player.id], [1002, sim.player.id]]));
  const scripts = new ScriptHost({ world, query: () => [] }); const module = itemSource.rows[0]?.hook?.module; if (module === undefined) throw new Error('Module missing'); scripts.install(module, hookBytes);
  const effects: string[] = [];
  const aim = { origin: { x: 0, y: 1.6, z: 0 }, direction: { x: 0, y: -1 / Math.hypot(1, 1.6), z: 1.6 / Math.hypot(1, 1.6) } };
  const icon = (id: string): EquipmentIcon => { if (id === 'sword' || id === 'glyph') return id; throw new Error('Unknown icon'); };
  const ports = { scope: sim.scope, actorId: sim.player.id, input, aim: () => aim, families: declaredKitItemFamilies(), icon,
    runtime: (row: ReturnType<typeof parseItems>['rows'][number]) => ({ actor: sim.player.health, combat: sim.combat,
      targets: () => [{ ...sim.combat.targetPort(target.combatActor(), target), aimPoint: new Vector3(target.position.x, target.position.y + target.dims.bodyY, target.position.z) }], effect: (_actor: unknown, id: string) => { effects.push(id); },
      hook: row.hook === null ? null : scriptItemHook(scripts, row.hook.module, row.hook.entity, row.hook.event, sim.player.id) }) };
  const items = installDeclaredItems(itemSource, ports); if (items.primary === null) throw new Error('Primary missing');
  const service = new EquipmentService(items.primary, { scope: sim.scope, events: sim.events, input: { bind: (action, run, scope, allowed) => input.bind(action, run, scope, allowed) } });
  if (items.secondary !== null) service.add(items.secondary, { locked: true });
  items.install(service);
  const step = (count = 1) => { for (let i = 0; i < count; i++) { scripts.beginTick(sim.state.tick + 1); sim.step(); items.step(sim.state.tick, 1 / 60); service.update(1 / 60, sim.clock.now); } };
  return { sim, target, input, scripts, effects, items, service, step, ports, aim };
}
describe('declared kit items through admitted AssemblyScript and normal equipment', () => {
  it('fires the fixture whip through one pipeline with cooldown, heavy poison and copied replay aim', () => {
    const f = fixture(); try {
      expect(f.service.list.map((w) => w.row.id)).toEqual(['weapon.template-whip', 'weapon.sword-iron']);
      expect(f.service.tools.map((t) => t.id)).toEqual(['tool.template-lantern']);
      f.input.press('attack'); expect(f.target.hp).toBe(100); f.step(); expect(f.target.hp).toBe(82);
      f.input.press('attack'); f.step(); expect(f.target.hp).toBe(82); f.step(24);
      f.input.press('heavy'); f.step(); expect(f.target.hp).toBe(52); expect(f.effects).toEqual(['effect.poison']);
      f.step(50); f.items.primary?.executeCommand({ action: 'attack', aim: { origin: { x: 9, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } } });
      f.step(); expect(f.target.hp).toBe(52);
      const actor = f.target.combatActor(); expect(f.sim.entities.get('boar:1')?.combatActor()).toBe(actor);
    } finally { f.sim.dispose(); }
  });
  it('runs the declared lantern hook and exhausts exactly its fixed-step fuel without a renderer loop', () => {
    const f = fixture(); try {
      const lantern = f.items.runtimes.get('tool.template-lantern'); if (lantern === undefined) throw new Error('Lantern missing');
      f.input.press('template.lantern.toggle'); f.step(); expect(lantern.lightOn).toBe(true);
      f.step(60); expect(lantern.remainingFuel).toBeCloseTo(119 / 120);
      f.input.press('template.lantern.toggle'); f.step(); expect(lantern.lightOn).toBe(false);
      const remaining = lantern.remainingFuel; f.step(60); expect(lantern.remainingFuel).toBe(remaining);
      f.input.press('template.lantern.toggle'); f.step(); f.step(7141); expect(lantern.lightOn).toBe(false); expect(lantern.remainingFuel).toBe(0);
      f.input.press('template.lantern.toggle'); f.step(); expect(lantern.lightOn).toBe(false);
      lantern.queue(4); f.step(); expect(lantern.remainingFuel).toBe(1); expect(lantern.lightOn).toBe(false);
      const tick = lantern.snapshot().tick; f.sim.dispose(); f.items.step(tick + 1, 1 / 60); expect(lantern.snapshot().tick).toBe(tick);
    } finally { f.sim.dispose(); }
  });
  it('rejects forged cross-item requests and gates held heavy charge on fixed ticks', async () => {
    const forged = await compileScript(scriptSource('store<f64>(24576,3);store<f64>(24584,101);store<f64>(24592,2);store<f64>(24600,1);', '', '1'));
    const bad = fixture(forged); try { bad.input.press('attack'); bad.step(); expect(bad.target.hp).toBe(100); } finally { bad.sim.dispose(); }
    const f = fixture(); try {
      const weapon = f.items.runtimes.get('weapon.template-whip'); if (weapon === undefined) throw new Error('Whip missing');
      weapon.hold(true, f.aim); f.step(36); weapon.hold(false, f.aim); f.step(); expect(f.target.hp).toBe(70);
      const saved = weapon.snapshot(); weapon.queue(1, f.aim); weapon.restore(saved); expect(weapon.snapshot()).toEqual(saved);
      expect(() => weapon.restore({ ...saved, fuel: Number.NaN })).toThrow(); expect(weapon.snapshot()).toEqual(saved);
    } finally { f.sim.dispose(); }
  });
  it('cancels a charged release when normal equipment disables the outgoing weapon', () => {
    const f = fixture(); try {
      f.service.adsHeld = true; f.step(40);
      f.service.enabled = false; f.step();
      expect(f.target.hp).toBe(100);
      expect(f.items.runtimes.get('weapon.template-whip')?.snapshot().held).toBe(false);
      f.service.adsHeld = false; f.service.enabled = true;
      f.input.press('attack'); f.step(); expect(f.target.hp).toBe(82);
    } finally { f.sim.dispose(); }
  });
  it('rejects closures, unresolved ids/contexts/families/actors and duplicate data before equipment runs', () => {
    const aliases = declaredItemScriptEntities(itemSource, 'actor.player');
    expect([...aliases.actors]).toEqual([[1001, 'actor.player'], [1002, 'actor.player']]);
    expect(aliases.entities.map((e) => e.name)).toEqual(['weapon.template-whip', 'tool.template-lantern']);
    expect(parseItems(itemSource).rows).toHaveLength(3); expect(itemRules(parseItems(itemSource), [])).toEqual(['item script module declared']);
    for (const change of [ { ...itemSource, callback: () => 1 }, { ...itemSource, rows: [...itemSource.rows, itemSource.rows[0]] },
      { ...itemSource, loadout: { ...itemSource.loadout, primary: 'weapon.missing' } }, { ...itemSource, rows: itemSource.rows.map((r) => ({ ...r, damage: Number.NaN })) } ]) expect(() => parseItems(change)).toThrow();
    const f = fixture(); try {
      expect(() => installDeclaredItems(itemSource, { ...f.ports, families: new Map() })).toThrow('family');
      expect(() => installDeclaredItems(itemSource, { ...f.ports, actorId: 'impostor' })).toThrow('host-bound');
      expect(() => f.items.runtimes.get('weapon.template-whip')?.queue(3)).toThrow();
    } finally { f.sim.dispose(); }
  });
});
