// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Load the installed physics WASM and retained canonical fixture, without network or app build.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { BoxGeometry, MeshStandardMaterial, Vector3 } from 'three';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { CreatureBodies } from '../src/engine/physics/creatures';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { tagOf } from '../src/engine/physics/surface';
import { groups } from '../src/engine/physics/groups';
import { Ragdolls, ragdollsFor } from '../src/engine/physics/ragdoll';
import { Animal } from '../src/engine/entities/AnimalView';
import { Physics } from '../src/engine/physics/Physics';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import type { DamageDealt } from '../src/engine/combat/pipeline';
import { PlayerHealth } from '../src/engine/combat/health';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { onFault, type Fault } from '../src/engine/core/faults';
import { NativeCreaturePose } from '../src/game/plugin/animation';
import { PracticeLoot } from '../src/game/practice/PracticeLoot';
import { Sword } from '../src/game/weapons/Sword';
import { SLASH } from '../src/game/weapons/starterMoves';
import { saveEnvironment } from '../src/engine/saves/environment';
import { readLootTables, registerLootTable } from '../src/game/loot/tables';
import { startPracticeDemo } from '../src/game/practiceDemo/startPracticeDemo';
import { practiceLevel } from '../src/practiceLevel';
import { app } from '../src/engine/app/runtime';
import { enterOwner } from '../src/engine/app/ownership';
import { loadRapier } from '../src/engine/physics/rapier';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { NO_FUR } from '../src/engine/entities/species/rigs';
import { SWORD_WOOD } from '../src/game/weapons/starterMeleeProfile';
import { PracticeCreature } from '../src/game/practice/PracticeCreature';
import { PracticeNativeActor } from '../src/game/practice/PracticeNativeActor';
import { graphicsOnly } from './practice-demo-headless';
import { readPracticePresentation } from '../src/practicePresentation';
import { fixtureRigidCorpse, prepareFixture, removeFixture } from './practice-native-fixture';


let product: Awaited<ReturnType<typeof prepareFixture>>;
beforeAll(async () => {
  // Node's streaming compiler rejects happy-dom Response identity; compile the identical bytes.
  const streaming = vi.spyOn(WebAssembly, 'instantiateStreaming').mockImplementation(async (source, imports) =>
    WebAssembly.instantiate(await (await source).arrayBuffer(), imports));
  try { product = await prepareFixture(); } finally { streaming.mockRestore(); }
  await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
}, 60000);
afterAll(removeFixture);

async function boot(poseFile: string | null = 'poses/native-proof.json', corpse = false) {
  const graphics = graphicsOnly(), statuses: string[] = [];
  document.body.innerHTML = '<canvas id="game"></canvas><div id="hud"></div>';
  const canvas = document.querySelector('canvas'); if (canvas === null) throw new Error('Missing canvas');
  const faults: Fault[] = []; const offFault = onFault(value => { faults.push(value); });
  const worldHealth = new PlayerHealth(app.events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  worldHealth.attributes.health = 37; worldHealth.attributes.incomingCap = 20;
  const worldBefore = worldHealth.snapshot();
  const worldHits = vi.fn<() => void>(), worldDeaths = vi.fn<() => void>(); const outside = new Scope('unrelated-world');
  app.events.on('damage.dealt', worldHits, outside); app.events.on('actor.died', worldDeaths, outside);
  localStorage.setItem('world-save-sentinel', 'unrelated progress and purse');
  const enter = vi.spyOn(PracticeCreature.prototype, 'enter');
  const demo = await graphics.load(startPracticeDemo({
    canvas, level: practiceLevel(), product, ...(poseFile === null ? {} : { nativePractice: { 'conch-duelist:conch-duelist': { poseFile, ...(corpse ? { corpse: 'rigid' as const } : {}) } } }),
    status: message => { statuses.push(message); },
    prepare: async game => {
      graphics.bind(game); app.registerPlayer(worldHealth, game.levelScope);
      for (const row of readLootTables(product.section('economy/loot').rows.loot[0]?.economy?.tables)) registerLootTable(row, game.levelScope);
      const presentation = readPracticePresentation(JSON.parse(new TextDecoder().decode(await product.file('practice/looks.json'))));
      const row = presentation.looks[0]; if (row === undefined) throw new Error('Missing actual product look');
      const animate = numericCreaturePose(JSON.parse(new TextDecoder().decode(await product.file(row.pose))));
      const species = product.section('actors/species-programs').program?.species[0];
      if (species === undefined) throw new Error('Missing Conch');
      const directory = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
      const metadata: unknown = JSON.parse(readFileSync(`${directory}/metadata.json`, 'utf8'));
      const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(Uint8Array.from(readFileSync(`${directory}/payload.bin`))));
      await bodies.preload();
      app.species.registerRow(species, game.levelScope);
      app.species.registerLook({ id: 'practice.proof.look', species: species.id, kind: species.kind,
        rigContract: { skeleton: 'conch-duelist.character-native15', clips: [], sockets: ['body', 'head'] },
        fur: NO_FUR, rig: 'custom', rootFlinch: 'authored-pose', build: variant => { const parts = bodies.copy(species.kind, variant.id); return corpse ? { ...parts, dims: { ...parts.dims, rigidCorpse: fixtureRigidCorpse } } : parts; },
        material: () => new MeshStandardMaterial(), animate,
      }, game.levelScope);
      return { row: SWORD_WOOD, rig: { sword: new BoxGeometry(.05, 1, .05), arms: new BoxGeometry(.05, .2, .05),
        material: new MeshStandardMaterial(), baseY: 0, tipY: 1 } };
    },
  }));
  function creature(): PracticeCreature {
    const value: unknown = enter.mock.contexts.at(-1);
    if (!(value instanceof PracticeCreature)) throw new Error('Missing real practice creature'); return value;
  }
  const weapons = app.equipment; if (!(weapons instanceof EquipmentService) || !(weapons.current instanceof Sword)) throw new Error('Missing actual equipment');
  const example = creature().targets[0]; if (example === undefined) throw new Error('Missing admitted creature');
  const other = new AnimalSim({ kind: example.kind, label: example.label, variant: example.variant, rarity: example.rarity, hp: 43, aggressive: false, dims: example.dims, mods: { ...example.mods } }, 91, 1, 'world.unrelated', { heightAt: () => 0, random: () => .5 });
  other.position.set(80, 0, 80); other.mem['world-sentinel'] = 17; const otherBefore = other.snapshot();
  app.combat.registerTargets(outside, () => [app.combat.targetPort(other.combatActor(), other)]);
  const sword = weapons.current; const write = vi.spyOn(localStorage, 'setItem');
  const physics = app.physics; if (!(physics instanceof Physics)) throw new Error('Missing actual physics');
  return { demo, graphics, statuses, faults, creature, enter, sword, weapons, physics,
    worldUnchanged: () => { expect(other.snapshot()).toEqual(otherBefore); expect(worldHealth.snapshot()).toEqual(worldBefore); expect(worldHits).not.toHaveBeenCalled(); expect(worldDeaths).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem('world-save-sentinel')).toBe('unrelated progress and purse'); expect(saveEnvironment().persistent()).toBe(false); expect(saveEnvironment().storage('shard')).toBeNull(); },
    dispose: () => { demo.dispose(); outside.dispose(); offFault(); enterOwner(null); graphics.dispose(); document.body.replaceChildren(); },
  };
}
function nativeOf(creature: PracticeCreature): PracticeNativeActor {
  const value: unknown = Reflect.get(creature, 'native');
  if (!(value instanceof PracticeNativeActor)) throw new Error('Missing real native owner'); return value;
}
function eventsOf(creature: PracticeCreature): Events {
  const value: unknown = Reflect.get(creature, 'events');
  if (!(value instanceof Events)) throw new Error('Missing bout events'); return value;
}
function scopeOf(creature: PracticeCreature): Scope {
  const value: unknown = Reflect.get(creature, 'bout');
  if (!(value instanceof Scope)) throw new Error('Missing bout scope'); return value;
}
function lootOf(creature: PracticeCreature): PracticeLoot {
  const value: unknown = Reflect.get(creature, 'loot');
  if (!(value instanceof PracticeLoot)) throw new Error('Missing local loot'); return value;
}

test('actual native demo enters and the real scheduler orders zero, single and catch-up fixed ticks', async () => {
  const f = await boot();
  try {
    const order: string[] = [], { demo, graphics, enter } = f, native = nativeOf(f.creature());
    const step = f.physics.step.bind(f.physics), playerStep = demo.player.step.bind(demo.player), fixed = native.fixed.bind(native);
    const update = f.weapons.update.bind(f.weapons), publish = f.creature().publishNativeFrame.bind(f.creature());
    vi.spyOn(f.physics, 'step').mockImplementation(() => { order.push('physics'); step(); });
    vi.spyOn(demo.player, 'step').mockImplementation(dt => { order.push('player'); playerStep(dt); });
    vi.spyOn(native, 'fixed').mockImplementation(() => { order.push('native'); fixed(); });
    vi.spyOn(f.weapons, 'update').mockImplementation((dt, t) => { order.push('weapon'); update(dt, t); });
    vi.spyOn(f.creature(), 'publishNativeFrame').mockImplementation(() => { order.push('publication'); publish(); });
    graphics.frame(0);
    expect(enter).toHaveBeenCalledOnce(); expect(demo.arena.entered).toBe(true); expect(app.state).toBe('practice');
    expect(order).toEqual(['publication', 'weapon', 'publication']);
    expect(native.host.clock.now).toBe(0);
    order.length = 0; graphics.frame(1 / 60);
    expect(order).toEqual(['physics', 'player', 'native', 'publication', 'weapon', 'publication']);
    expect(demo.game.fixedSteps).toBe(1); expect(native.host.clock.now).toBeCloseTo(1 / 60);
    const beforeZero = native.snapshot(); order.length = 0; graphics.frame(1 / 240);
    expect(order).toEqual(['publication', 'weapon', 'publication']); expect(demo.game.fixedSteps).toBe(0); expect(native.snapshot()).toEqual(beforeZero);
    order.length = 0; graphics.frame(1 / 30);
    expect(order).toEqual(['physics', 'player', 'native', 'physics', 'player', 'native', 'publication', 'weapon', 'publication']);
    expect(demo.game.fixedSteps).toBe(2); expect(native.host.clock.now).toBeCloseTo(3 / 60);
    expect(f.faults).toEqual([]); expect(demo.game.dead).toBe(false); f.worldUnchanged();
    demo.retry(); expect(enter).toHaveBeenCalledTimes(2); expect(nativeOf(f.creature()).host.clock.now).toBe(0);
  } finally { f.dispose(); }
});

type Fixture = Awaited<ReturnType<typeof boot>>;
function aim(f: Fixture): void {
  const p = nativeOf(f.creature()).actor.position;
  f.demo.player.spawn(p.x, p.z + 1.5, 0, p.y);
  f.sword.setAimCommand({ origin: { x: p.x, y: p.y + 1.3, z: p.z + 1.5 }, direction: { x: 0, y: 0, z: -1 } });
}
function swing(f: Fixture, damage: number, done: () => boolean): void {
  for (let i = 0; i < 150 && f.sword.swingName !== null; i++) f.graphics.frame(1 / 120);
  expect(f.sword.swingName).toBeNull(); aim(f); f.sword.damage = damage;
  let started = f.sword.strikeMove(SLASH, false);
  for (let i = 0; i < 60 && !started; i++) { f.graphics.frame(1 / 240); started = f.sword.strikeMove(SLASH, false); }
  expect(started).toBe(true);
  for (let i = 0; i < 160 && !done(); i++) f.graphics.frame(1 / 240);
  expect(done()).toBe(true);
}
function observe(native: PracticeNativeActor, events: Events) {
  const head = new Vector3(), rear = new Vector3(), front = new Vector3();
  native.pose.headWorld(head); native.pose.bodyCapsule(rear, front);
  return { actor: native.actor.snapshot(), pose: native.pose.snapshot(), native: native.snapshot(),
    head: head.toArray(), rear: rear.toArray(), front: front.toArray(), events: events.snapshot(payload => JSON.stringify(payload)) };
}
function retireCheck(f: Fixture) {
  const creature = f.creature(), native = nativeOf(creature), events = eventsOf(creature), scope = scopeOf(creature);
  const view = creature.targets[0]; if (!(view instanceof Animal)) throw new Error('Missing actual bound view');
  const motor = native.actor.motor; if (!(motor instanceof CharacterMotor)) throw new Error('Missing actual character motor');
  const handle = motor.collider.handle, hitboxes: number[] = [];
  f.physics.world.forEachCollider(collider => {
    const owner = tagOf(collider)?.owner;
    if (typeof owner === 'object' && owner !== null && Reflect.get(owner, 'creature') === view) hitboxes.push(collider.handle);
  });
  expect(hitboxes).toHaveLength(2); expect(app.combat.target(view)?.actor).toBe(native.actor.combatActor());
  const dispose = motor.dispose.bind(motor);
  const disposeMotor = vi.spyOn(motor, 'dispose').mockImplementation(() => { dispose(); expect(f.physics.world.colliders.contains(handle)).toBe(false); });
  const bodies: unknown = Reflect.get(creature, 'bodies'); if (!(bodies instanceof CreatureBodies)) throw new Error('Missing query body owner');
  const remove = bodies.remove.bind(bodies);
  const removeBoxes = vi.spyOn(bodies, 'remove').mockImplementation(body => { remove(body); for (const box of hitboxes) expect(f.physics.world.colliders.contains(box)).toBe(false); });
  return () => {
    expect(scope.disposed).toBe(true); expect(Object.values(scope.census).every(count => count === 0)).toBe(true);
    expect(events.census()).toEqual({ listeners: 0, answerers: 0 }); expect(disposeMotor).toHaveBeenCalledOnce();
    expect(removeBoxes).toHaveBeenCalledOnce(); // Rapier may reuse numeric slots for the fresh bout; verify removal at the actual disposal boundary above.
    const routes: unknown = Reflect.get(app.combat, 'targetRoutes'); if (!(routes instanceof Map)) throw new Error('Missing route map');
    expect(routes.has(native.actor.combatActor())).toBe(false); expect(app.combat.target(view)).toBeNull();
    expect(view.mesh.parent).toBeNull(); expect(view.hidden).toBe(true); expect(native.actor.alive).toBe(false);
    expect(() => native.snapshot()).toThrow('disposed'); const retired = native.actor.snapshot(); native.fixed();
    expect(native.actor.snapshot()).toEqual(retired); expect(events.census()).toEqual({ listeners: 0, answerers: 0 });
  };
}

test('actual weapon contacts publish immediate local hit/death, pay loot once and Retry/reselection retire the full bout', async () => {
  const f = await boot();
  try {
    const creature = f.creature(), native = nativeOf(creature), events = eventsOf(creature), loot = lootOf(creature);
    const initial = { control: native.control.snapshot(), pose: native.pose.snapshot() }, retired = retireCheck(f);
    const receipts: { amount: number; killed: boolean }[] = []; let deaths = 0;
    events.on('damage.dealt', value => { if (value.req.target === native.actor.combatActor()) receipts.push({ amount: value.dealt, killed: value.killed }); }, scopeOf(creature));
    events.on('actor.died', () => { deaths++; }, scopeOf(creature));
    const advance = vi.spyOn(native.pose, 'advance'), applied: { fixed: number; ordinal: number | undefined; killed: boolean }[] = [];
    const apply = native.actor.applyFinalDamage.bind(native.actor);
    vi.spyOn(native.actor, 'applyFinalDamage').mockImplementation((amount, point, dir) => {
      const clock = native.host.clock.now, calls = advance.mock.calls.length, count = receipts.length;
      const killed = apply(amount, point, dir);
      expect(native.host.clock.now).toBe(clock); expect(advance).toHaveBeenCalledTimes(calls); expect(receipts).toHaveLength(count);
      expect(native.pose.context.alive).toBe(!killed);
      applied.push({ fixed: f.demo.game.fixedSteps, ordinal: native.pose.context.transition?.ordinal, killed });
      return killed;
    });
    swing(f, 12, () => receipts.length === 1);
    expect(f.faults).toEqual([]); expect(receipts[0]).toEqual({ amount: 12, killed: false });
    expect(applied[0]).toEqual({ fixed: 0, ordinal: 1, killed: false }); expect(deaths).toBe(0);
    expect(native.actor.hp).toBe(native.actor.maxHp - 12);
    const viewHead = creature.targets[0]?.mesh.skeleton.bones.find(bone => bone.name === 'head'), poseHead = native.pose.bones['head'];
    expect(viewHead?.position.toArray()).toEqual(poseHead?.position.toArray());
    swing(f, 10000, () => deaths === 1);
    expect(receipts).toHaveLength(2); expect(receipts[1]?.killed).toBe(true); expect(native.actor.hp).toBe(0);
    expect(native.actor.alive).toBe(false); expect(native.pose.context.transition?.ordinal).toBe(2);
    expect(native.pose.context.deathT).toBe(0); expect(native.pose.context.attack).toBe(-1);
    expect(viewHead?.position.toArray()).toEqual(poseHead?.position.toArray());
    expect(loot.inFlight).toBeGreaterThan(0); expect(f.statuses.filter(message => message.startsWith('Opponent defeated'))).toHaveLength(1);
    for (let i = 0; i < 200; i++) f.graphics.frame(1 / 60);
    expect(loot.receipt).toEqual({ scope: 'practice', coins: 3, complete: true }); expect(loot.inFlight).toBe(0);
    const notifications = f.statuses.length;
    for (let i = 0; i < 10; i++) { creature.publishNativeFrame(); f.graphics.frame(1 / 60); }
    expect(f.statuses).toHaveLength(notifications); expect(receipts).toHaveLength(2); expect(deaths).toBe(1);
    f.demo.retry(); retired();
    const fresh = nativeOf(f.creature()); expect(f.creature()).toBe(creature); expect(fresh).not.toBe(native);
    expect(fresh.actor.hp).toBe(fresh.actor.maxHp); expect(fresh.host.clock.now).toBe(0);
    expect(fresh.pose.snapshot()).toBe(initial.pose); expect(fresh.control.snapshot()).toBe(initial.control);
    expect(f.creature().playerHealth).toBe(f.creature().playerMaxHealth); expect(lootOf(f.creature()).receipt).toEqual({ scope: 'practice', coins: 0, complete: false });
    const retryRetired = retireCheck(f);
    expect(await f.graphics.load(f.demo.select('conch-duelist:conch-duelist'))).toBe(true); retryRetired();
    expect(f.creature()).not.toBe(creature); expect(nativeOf(f.creature()).pose.snapshot()).toBe(initial.pose);
    expect(nativeOf(f.creature()).control.snapshot()).toBe(initial.control); expect(f.faults).toEqual([]); f.worldUnchanged();
    const lastRetired = retireCheck(f); f.demo.arena.exit(); lastRetired();
    expect(f.demo.arena.entered).toBe(false); expect(f.creature().targets).toEqual([]); f.worldUnchanged();
  } finally { f.dispose(); }
});

test('native lethal publication retires the living motor but does not yet own a physical corpse', async () => {
  const spawn = vi.spyOn(Ragdolls.prototype, 'spawn'), f = await boot();
  try {
    const native = nativeOf(f.creature()), view = f.creature().targets[0];
    if (!(view instanceof Animal)) throw new Error('Missing actual bound view');
    const motor = native.actor.motor; if (!(motor instanceof CharacterMotor)) throw new Error('Missing living motor');
    const dispose = vi.spyOn(motor, 'dispose'), events = eventsOf(f.creature()); let deaths = 0;
    events.on('actor.died', () => { deaths++; }, scopeOf(f.creature()));
    const debrisCount = (): number => {
      let count = 0;
      f.physics.world.forEachCollider(collider => { if (collider.collisionGroups() === groups('DEBRIS')) count++; });
      return count;
    };
    expect(debrisCount()).toBe(0); expect(view.dims.rigidCorpse).toBeUndefined();
    swing(f, 10000, () => deaths === 1);
    const lethalRoot = native.actor.position.toArray();
    expect(native.pose.context.alive).toBe(false); expect(native.pose.context.transition?.kind).toBe(2);
    expect(view.mesh.position.toArray()).toEqual(lethalRoot);
    for (let i = 0; i < 120; i++) f.graphics.frame(1 / 60);
    // This is a missing-owner characterization, not a complete-death/contact acceptance test.
    expect(dispose).toHaveBeenCalledOnce(); expect(native.actor.motor).toBeNull();
    expect(spawn).not.toHaveBeenCalled(); expect(Reflect.get(view, 'ragdoll')).toBeNull(); expect(debrisCount()).toBe(0);
    expect(native.actor.position.toArray()).toEqual(lethalRoot); expect(view.mesh.position.toArray()).toEqual(lethalRoot);
    expect(native.pose.context.deathT).toBe(1); expect(deaths).toBe(1);
    expect(f.faults).toEqual([]); f.worldUnchanged();
  } finally { f.dispose(); }
});

test('refused numeric weapon contact reaches the actual Game retry fault policy without partial damage, then a valid swing succeeds', async () => {
  const f = await boot('poses/native-refusal.json');
  try {
    const native = nativeOf(f.creature()), events = eventsOf(f.creature());
    const receipts = vi.fn<(value: DamageDealt) => void>(), deaths = vi.fn<() => void>(); events.on('damage.dealt', receipts, scopeOf(f.creature())); events.on('actor.died', deaths, scopeOf(f.creature()));
    const hit = app.combat.hit.bind(app.combat); let refusals = 0;
    vi.spyOn(app.combat, 'hit').mockImplementation(request => {
      if (request.target !== native.actor.combatActor()) return hit(request);
      const before = observe(native, events);
      try { return hit(request); }
      catch (error) { expect(observe(native, events)).toEqual(before); refusals++; throw error; }
    });
    swing(f, 10000, () => f.faults.length === 1);
    expect(refusals).toBe(1); expect(f.faults).toHaveLength(1);
    expect(f.faults[0]?.system).toBe('demo.weapon'); expect(f.faults[0]?.verdict).toBe('retry');
    expect(String(f.faults[0]?.error)).toContain('Non-finite or excessive client expression');
    expect(native.actor.hp).toBe(native.actor.maxHp); expect(native.actor.alive).toBe(true);
    expect(native.pose.context.transition?.ordinal).toBe(0); expect(receipts).not.toHaveBeenCalled(); expect(deaths).not.toHaveBeenCalled();
    expect(f.demo.game.dead).toBe(false); expect(f.weapons.enabled).toBe(true); f.worldUnchanged();
    swing(f, 1, () => receipts.mock.calls.length === 1);
    expect(receipts.mock.calls[0]?.[0].dealt).toBeGreaterThan(0);
    expect(native.actor.hp).toBe(native.actor.maxHp - (receipts.mock.calls[0]?.[0].dealt ?? 0)); expect(native.pose.context.transition?.ordinal).toBe(1);
    expect(receipts).toHaveBeenCalledOnce(); expect(deaths).not.toHaveBeenCalled(); expect(refusals).toBe(1);
    expect(f.faults).toHaveLength(1); expect(f.demo.game.dead).toBe(false); f.worldUnchanged();
  } finally { f.dispose(); }
});

test('real admitted decision attacks defeat only the local player and Retry re-enables a fresh bout', async () => {
  const f = await boot();
  try {
    const native = nativeOf(f.creature()), events = eventsOf(f.creature()); let hits = 0;
    events.on('damage.dealt', value => { if (value.req.target.id === 'actor.player') hits++; }, scopeOf(f.creature()));
    aim(f);
    for (let i = 0; i < 2400 && f.creature().playerHealth > 0; i++) f.graphics.frame(1 / 60);
    expect(hits).toBeGreaterThanOrEqual(5); expect(f.creature().playerHealth).toBe(0);
    expect(f.demo.player.carried).toBe(true); expect(f.weapons.enabled).toBe(false);
    expect(f.statuses.filter(message => message.startsWith('Defeated.'))).toHaveLength(1);
    expect(app.combat.targets().every(target => !target.hittable)).toBe(true);
    const count = hits; for (let i = 0; i < 120; i++) f.graphics.frame(1 / 60);
    expect(hits).toBe(count); expect(f.creature().playerHealth).toBe(0); expect(native.actor.alive).toBe(true);
    const retired = retireCheck(f); f.demo.retry(); retired();
    expect(f.demo.player.carried).toBe(false); expect(f.weapons.enabled).toBe(true);
    expect(f.creature().playerHealth).toBe(f.creature().playerMaxHealth); expect(nativeOf(f.creature()).pose.context.transition?.ordinal).toBe(0);
    expect(f.faults).toEqual([]); f.worldUnchanged();
  } finally { f.dispose(); }
});

test('absent selection still boots the actual existing practice owner without native clocks or publication', async () => {
  const fixed = vi.spyOn(PracticeNativeActor.prototype, 'fixed'), pose = vi.spyOn(NativeCreaturePose.prototype, 'advance');
  const f = await boot(null);
  try {
    expect(Reflect.get(f.creature(), 'native')).toBeNull(); expect(f.creature().targets[0]?.simulationBound).toBe(false);
    for (let i = 0; i < 12; i++) f.graphics.frame(1 / 60);
    expect(fixed).not.toHaveBeenCalled(); expect(pose).not.toHaveBeenCalled(); expect(f.creature().targets[0]?.alive).toBe(true);
    expect(f.demo.game.dead).toBe(false); expect(f.faults).toEqual([]); f.worldUnchanged();
  } finally { f.dispose(); }
});


test('actual demo physical opt-in pairs one scheduler, late weapon death, fixed corpse root and fresh Retry', async () => {
  const f = await boot('poses/native-proof.json', true);
  try {
    const native = nativeOf(f.creature()), system = ragdollsFor(f.physics), old = native.actor.motor;
    if (!(old instanceof CharacterMotor)) throw new Error('Missing real motor');
    expect(system.reserved).toBe(1); const drop = vi.spyOn(lootOf(f.creature()), 'drop');
    const advance = vi.spyOn(native.pose, 'advance'), pre = vi.spyOn(native, 'preFixed'), physics = vi.spyOn(f.physics, 'step');
    swing(f, 10000, () => !native.actor.alive);
    expect(drop).toHaveBeenCalledOnce(); expect(native.pose.context.deathT).toBe(0); expect(native.actor.motor).toBeNull();
    const lethal = native.actor.position.clone(), ordinary = advance.mock.calls.length;
    const physicsBefore = physics.mock.calls.length, preBefore = pre.mock.calls.length, clock = native.host.clock.frame;
    f.graphics.frame(0); expect(physics.mock.calls.length).toBe(physicsBefore); expect(native.host.clock.frame).toBe(clock);
    f.graphics.frame(1 / 60); expect(physics.mock.calls.length - physicsBefore).toBe(1); expect(pre.mock.calls.length - preBefore).toBe(1);
    expect(old.collider.isValid()).toBe(false); expect(native.actor.position.equals(lethal)).toBe(false);
    expect(advance).toHaveBeenCalledTimes(ordinary); expect(native.pose.context.deathT).toBeGreaterThan(0);
    const view = f.creature().targets[0]; if (view === undefined) throw new Error('Missing bound view');
    for (let i = 0; i < 310; i++) f.graphics.frame(1 / 60);
    expect(native.actor.motor).toBeNull(); expect(system.occupied).toBe(0); expect(drop).toHaveBeenCalledOnce();
    expect(drop.mock.calls[0]?.[0].position).toEqual(lethal); expect(advance).toHaveBeenCalledTimes(ordinary);
    view.renderPublishedPose(1); expect(view.mesh.position).toEqual(native.actor.position);
    f.demo.retry(); const fresh = nativeOf(f.creature()); expect(fresh).not.toBe(native); expect(system.reserved).toBe(1);
    expect(fresh.actor.hp).toBe(fresh.actor.maxHp); expect(fresh.host.clock.frame).toBe(0);
    swing(f, 10000, () => !fresh.actor.alive); f.demo.retry(); expect(system.reserved).toBe(1); expect(system.live).toBe(0);
    expect(f.faults).toEqual([]); f.worldUnchanged();
  } finally { f.dispose(); }
});
